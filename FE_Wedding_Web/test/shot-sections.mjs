// Mo phong bi roi chup tung phan cua thiep de doi chieu bang mat.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const CHROME = [process.env.CHROME_PATH,
  [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
].filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.goto(process.env.TPL_URL || 'http://localhost:4180/index.html', { waitUntil: 'networkidle2', timeout: 40000 })
await new Promise((r) => setTimeout(r, 1500))

// Mo phong bi
await page.evaluate(() => {
  const seal = document.getElementById('wax-seal') || document.getElementById('envelope-container')
  if (seal) seal.click()
})
await new Promise((r) => setTimeout(r, 3500))

const out = process.env.OUT_DIR || '.'
const sections = ['hero', 'couple', 'family', 'invitation-day', 'ceremony', 'timeline', 'footer']
for (const id of sections) {
  const ok = await page.evaluate((sid) => {
    const el = document.getElementById(sid)
    if (!el) return false
    el.scrollIntoView({ block: 'start' })
    return true
  }, id)
  if (!ok) { console.log('khong thay muc', id); continue }
  await new Promise((r) => setTimeout(r, 700))
  await page.screenshot({ path: `${out}/sec-${id}.png` })
  console.log('da chup', id)
}
await browser.close()
