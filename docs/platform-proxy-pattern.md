# 中国平台 API 代理模式（Platform Proxy Pattern）

## 背景

主流中国平台（B站、豆瓣、微博、小红书等）均不提供面向公众的 CORS 友好 API。
直接在浏览器中 `fetch` 这些接口会被浏览器的同源策略拦截。

解决方案：在 Vercel Serverless Function 中作为代理，服务器之间的 HTTP 请求不受 CORS 限制。

---

## 核心框架：`api/_lib/createProxy.js`

所有平台适配器共享同一套框架，只需实现三个函数：

```
bootstrap(req)           →  session    获取匿名身份（cookie / token）
search(query, session)   →  raw[]      执行搜索，返回原始数据
normalize(raw)           →  Result     原始数据 → 统一格式
```

调用 `createHandler({ bootstrap, search, normalize })` 即可得到标准 Vercel handler。

### 统一返回格式

所有平台的 normalize() 函数必须返回以下结构，缺失字段用空字符串或 0：

```js
{
  id:       string,   // 平台内唯一 ID
  title:    string,   // 标题
  year:     string,   // 上映年份（4位）
  rating:   number,   // 评分，统一到 0–10
  overview: string,   // 简介
  poster:   string,   // 封面图 URL
  genre:    string,   // 类型标签
  source:   string,   // 平台标识
  url:      string,   // 原始页面链接
}
```

---

## 各平台难度与机制对比

| 平台 | 难度 | 匿名身份获取 | 签名算法 | 可逆向程度 |
|------|------|-------------|---------|---------|
| 豆瓣 | ⭐ | 访问首页取 `bid` cookie | 无 | — |
| 微博 | ⭐⭐ | visitor genvisitor → incarnate | 无（游客态） | — |
| B站 | ⭐⭐⭐ | `finger/spi` 取 buvid3 → nav 取 WBI 密钥 | WBI（MD5）| 高，有完整文档 |
| 小红书 | ⭐⭐⭐⭐⭐ | 需逆向 JS 生成 `x-legacy-did` | `main_hmac` 多层签名 | 低，持续对抗 |

---

## 已实现平台详解

### 豆瓣（`api/douban.js`）

**最简单的模式：无签名，仅需 cookie。**

```
bootstrap:
  GET https://www.douban.com
    └─ Set-Cookie: bid=xxxxx   ← 匿名会话 ID，只需这一个 cookie

search:
  主路  GET api.douban.com/v2/movie/search?q={q}&apikey=...  →  有评分
  备路  GET movie.douban.com/j/subject_suggest?q={q}         →  无评分（fallback）
  两路并行（Promise.allSettled），主路成功则用主路结果
```

**关键参考项目：**
- [caryyu/douban-openapi-server](https://github.com/caryyu/douban-openapi-server)

**注意：** v2 API 使用的 apikey 为社区流通的公开 key，仅适用于个人学习场景。

---

### 微博（`api/weibo.js`）

**Visitor Session 模式：两步换取游客 cookie，无需账号。**

```
bootstrap:
  POST passport.weibo.com/visitor/genvisitor
    └─ { data: { tid } }        ← 临时 ID，有效期约5分钟

  GET  passport.weibo.com/visitor/visitor?a=incarnate&t={tid}&...
    └─ Set-Cookie: SUB=...; SUBP=...   ← 游客态 session cookie

search:
  GET m.weibo.cn/api/container/getIndex?containerid=100103type=1&q={query}
    └─ 携带 SUB/SUBP cookie，返回搜索结果卡片
```

**关键参考项目：**
- [lucasjinreal/weibo_terminater](https://github.com/lucasjinreal/weibo_terminater)

**注意：** 微博返回的是 UGC 帖子，不是结构化影视数据，适合社交声量类场景。

---

### B站（`api/bilibili.js`）

**WBI 签名模式：动态密钥 + MD5 参数签名。**

```
bootstrap:
  GET api.bilibili.com/x/frontend/finger/spi
    └─ { data: { b_3: buvid3 } }       ← 设备指纹，无需任何凭证

  GET api.bilibili.com/x/web-interface/nav  （携带 buvid3）
    └─ { data: { wbi_img: { img_url, sub_url } } }
       img_key = img_url 文件名去掉 .png
       sub_key = sub_url 文件名去掉 .png
       mixinKey = MIXIN_KEY_ENC_TAB 索引混淆（取前32位）

search:
  params 按 key 字典序排序
  附加 wts = 当前秒级时间戳
  w_rid = MD5(排序后的 querystring + mixinKey)
  GET .../wbi/search/type?{signed_params}&w_rid=...&wts=...
  同时搜索 media_bangumi（番剧）和 media_ft（影视）
```

**MIXIN_KEY_ENC_TAB 说明：**
B站不定期更新这个索引表（约每季度一次）。若接口返回 `-352` 错误，需从
[bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md)
同步最新索引表。

---

## 接入新平台的步骤

1. **确认匿名身份接口**
   - 访问平台网页，用 DevTools Network 过滤 XHR，找无需 cookie 的首个接口
   - 检查响应是否含 `Set-Cookie`，记录必要的 cookie 名

2. **确认签名算法**
   - 观察搜索请求是否有 `sign`/`token`/`_t` 等额外参数
   - 搜索 GitHub：`{平台名} api sign algorithm`
   - 确认是否可以用纯 Node.js（crypto 模块）复现，还是需要运行混淆 JS

3. **创建适配器文件**（`api/{platform}.js`）
   ```js
   import { httpGet, extractSetCookies, createHandler } from './_lib/createProxy.js'

   async function bootstrap() { /* 获取 session */ }
   async function search(query, session) { /* 返回 raw[] */ }
   function normalize(item) { /* 返回统一格式 */ }

   export default createHandler({ bootstrap, search, normalize })
   ```

4. **在 `sources.json` 注册**
   ```json
   {
     "id": "platform_id",
     "url": "/api/{platform}?q={query}",
     "parse": { "resultsPath": "results", "fields": { ... } }
   }
   ```

5. **本地测试**
   ```bash
   vercel dev   # 同时启动前端 + Serverless Functions
   # 访问 http://localhost:3000/api/{platform}?q=测试
   ```

---

## 稳定性与维护

| 风险 | 现象 | 处理方式 |
|------|------|---------|
| 签名算法更新（B站 WBI） | `-352` / `-412` 错误码 | 同步 bilibili-API-collect 最新索引表 |
| 游客 session 策略收紧（微博） | `bootstrap` 失败 | 检查 genvisitor 接口参数变化 |
| 接口域名迁移（豆瓣） | 404 / 连接拒绝 | 用 DevTools 重新抓包确认新地址 |
| 频率限制 | `429` / `-412` | 在 Vercel Function 中加 `Cache-Control: s-maxage=3600` |

Vercel Function 默认已设置 `s-maxage=3600`（1小时 CDN 缓存），相同查询词在缓存期内只触发一次真实请求，有效缓解频率限制。

---

## 本地开发

B站、豆瓣、微博三个接口只在 Serverless Function 环境下运行，本地用 `npm run dev` 时这些源会自动静默失败（返回空数组），不影响其他数据源。

如需本地测试这三个接口：
```bash
npm install -g vercel
vercel dev       # 在 localhost:3000 同时运行前端和 Functions
```
