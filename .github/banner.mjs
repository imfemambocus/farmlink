import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * builds the readme banner, one file per theme. writes a self-contained banner.html (the
 * app's own Poppins embedded, so it renders identically anywhere) and screenshots it twice.
 *
 * png rather than svg: github will not load a webfont for an svg in a readme, so an svg
 * version falls back to whatever face the viewer happens to have.
 *
 *   npm install --no-save puppeteer && node .github/banner.mjs
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const FONTS = resolve(HERE, '..', 'frontend', 'assets', 'fonts')

const font = (file) => readFileSync(resolve(FONTS, file)).toString('base64')

const REGULAR = font('Poppins-Regular.ttf')
const SEMIBOLD = font('Poppins-SemiBold.ttf')

const W = 1280
const H = 360

// the product grid: [name bar, price bar, recommended]
const TILES = [
  [64, 34, false],
  [78, 30, true],
  [58, 38, false],
  [72, 32, false],
  [60, 36, false],
  [82, 28, false],
]

const tiles = TILES.map(
  ([name, price, recommended]) => `
    <div class="tile${recommended ? ' pick' : ''}">
      <div class="thumb"></div>
      <span class="bar" style="width:${name}px"></span>
      <span class="bar dim" style="width:${price}px"></span>
    </div>`,
).join('')

const page = `<!doctype html>
<html data-theme="dark"><head><meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Poppins';
    src: url(data:font/ttf;base64,${REGULAR}) format('truetype');
    font-weight: 400;
  }
  @font-face {
    font-family: 'Poppins';
    src: url(data:font/ttf;base64,${SEMIBOLD}) format('truetype');
    font-weight: 600;
  }

  /* the app's own greens, one step deeper for the dark surface */
  html[data-theme='dark'] {
    --bg: #0b0f0c;
    --fg: #f2f5ef;
    --muted: #8f9a8c;
    --accent: #8bc34a;
    --line: #232a22;
  }

  html[data-theme='light'] {
    --bg: #f7faf2;
    --fg: #1b2419;
    --muted: #5f6b5c;
    --accent: #4caf50;
    --line: #dfe7d3;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${W}px;
    height: ${H}px;
    background: var(--bg);
    color: var(--fg);
    font-family: 'Poppins', sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 76px;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  .left { display: flex; flex-direction: column; gap: 22px; }
  .brand { display: flex; align-items: center; gap: 13px; }
  .brand svg { width: 30px; height: 30px; color: var(--accent); }
  .brand span { font-size: 37px; font-weight: 600; letter-spacing: -0.035em; }
  .tagline { font-size: 17px; line-height: 1.5; color: var(--muted); max-width: 25ch; }
  .eyebrow {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* the storefront the app opens on, with the one row the recommender put there */
  .motif { width: 430px; flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .tile {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .tile.pick { border-color: var(--accent); }
  .thumb { height: 42px; border-radius: 6px; background: var(--fg); opacity: 0.1; }
  .tile.pick .thumb { background: var(--accent); opacity: 0.28; }
  .bar { height: 4px; border-radius: 999px; background: var(--fg); opacity: 0.34; }
  .bar.dim { opacity: 0.16; }
  .tile.pick .bar { background: var(--accent); opacity: 0.75; }
  .tile.pick .bar.dim { opacity: 0.4; }
</style></head><body>
  <div class="left">
    <div class="brand">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <g stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 28V14"/>
          <path d="M16 17c0-6 4-10 11-10 0 7-4 11-11 10Z"/>
          <path d="M15 21c0-4-3-7-8-7 0 5 3 8 8 7Z"/>
        </g>
      </svg>
      <span>Farmlink</span>
    </div>
    <p class="tagline">Mauritian farmers and the people who buy from them, with nobody in between.</p>
    <p class="eyebrow">React Native &nbsp;&middot;&nbsp; FastAPI &nbsp;&middot;&nbsp; Recommender</p>
  </div>
  <div class="motif">${tiles}</div>
</body></html>
`

const html = resolve(HERE, 'banner.html')
writeFileSync(html, page)

const require = createRequire(join(process.cwd(), '/'))
let puppeteer
try {
  puppeteer = require('puppeteer')
} catch {
  console.log('puppeteer not installed. open .github/banner.html and screenshot it, or:')
  console.log('  npm install --no-save puppeteer && node .github/banner.mjs')
  process.exit(0)
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const tab = await browser.newPage()
await tab.setViewport({ width: W, height: H, deviceScaleFactor: 2 })
await tab.goto('file://' + html, { waitUntil: 'networkidle0' })

for (const theme of ['dark', 'light']) {
  await tab.evaluate((value) => {
    document.documentElement.dataset.theme = value
  }, theme)
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: resolve(HERE, `banner-${theme}.png`) })
  console.log(`wrote .github/banner-${theme}.png`)
}

await browser.close()
