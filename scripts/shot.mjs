// Скриншоты для самопроверки: node scripts/shot.mjs http://localhost:4173 / /board ...
// Сохраняет в screenshots/tmp/<route>-<mobile|desktop>[-light].png
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium, devices } = require(process.env.PW_PATH || 'playwright')
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:4173', ...routes] = process.argv.slice(2)
const themes = (process.env.THEMES || 'dark').split(',')
const out = 'screenshots/tmp'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const viewports = {
  mobile: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}
for (const theme of themes) {
  for (const [name, opts] of Object.entries(viewports)) {
    const ctx = await browser.newContext({ ...opts, colorScheme: theme })
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && console.log(`[console:${name}]`, m.text()))
    page.on('pageerror', (e) => console.log(`[pageerror:${name}]`, e.message))
    for (const r of routes.length ? routes : ['/']) {
      await page.goto(`${base}/#${r}`)
      await page.waitForTimeout(Number(process.env.WAIT || 1200))
      const slug = r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
      await page.screenshot({ path: `${out}/${slug}-${name}${theme === 'light' ? '-light' : ''}.png` })
    }
    await ctx.close()
  }
}
await browser.close()
console.log('ok')
