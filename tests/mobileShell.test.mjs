import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { shouldShowSiteChrome } from '../src/mobileReaderShell.js'

const appPath = path.resolve('src/App.jsx')
const cssPath = path.resolve('src/index.css')

test('site chrome stays visible in library and hides in reader view', () => {
  assert.equal(shouldShowSiteChrome('library'), true)
  assert.equal(shouldShowSiteChrome('reader'), false)
})

test('app shell marks the reader view with a dedicated class', () => {
  const source = fs.readFileSync(appPath, 'utf8')
  assert.match(source, /reader-active/)
})

test('mobile css hides the global site chrome while reading', () => {
  const source = fs.readFileSync(cssPath, 'utf8')
  assert.match(source, /\.site-shell\.reader-active\s+\.site-chrome/)
})

test('reader layout protects flex children with min-height guards', () => {
  const source = fs.readFileSync(cssPath, 'utf8')
  assert.match(source, /\.reader-body[\s\S]*min-height:\s*0/)
  assert.match(source, /\.viewer-area[\s\S]*min-height:\s*0/)
})
