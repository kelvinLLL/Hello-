import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => ({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    // /api/* 在本地开发时需要 `vercel dev` 而非 `npm run dev`
    // 这里配置代理以便 vercel dev 启动后前端也能调通 B站接口
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          epub: ['epubjs'],
        },
      },
    },
  },
}))
