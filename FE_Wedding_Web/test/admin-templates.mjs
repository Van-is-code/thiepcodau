// Kiem tra trang quan ly mau bang Chrome that.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
if (!CHROME) { console.error('Khong tim thay Chrome'); process.exit(2) }

const FE = process.env.FE_URL || 'http://localhost:5173'
const res = []
const check = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? 'DAT   ' : 'TRUOT '} | ${n}${d ? ' :: ' + d : ''}`) }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

// Dang nhap bang cach dat token truc tiep (tranh phu thuoc form)
await page.goto(FE + '/auth', { waitUntil: 'domcontentloaded' })
const token = await page.evaluate(async () => {
  const r = await fetch('http://localhost:3000/api/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const b = await r.json()
  localStorage.setItem('token', b?.data?.token || '')
  return b?.data?.token || null
})
check('Dang nhap admin', Boolean(token))

await page.goto(FE + '/admin', { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1200))

// Mo tab Quan Ly Mau
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Quản Lý Mẫu/i.test(x.textContent))
  if (b) { b.click(); return true }
  return false
})
check('Mo duoc tab Quan Ly Mau', clicked)
await new Promise((r) => setTimeout(r, 1500))

const text = await page.evaluate(() => document.body.innerText)
check('Hien thi mau da nhap', /blue-botanical/i.test(text), text.match(/blue-botanical/i)?.[0] || 'khong thay')
check('Co nut Nhap theme moi', /Nhập theme mới/i.test(text))
check('Hien muc hien thi (Cong khai/Gioi han/Doc quyen)', /Công khai|Giới hạn|Độc quyền/.test(text))
check('Hien so thiep dang dung', /thiệp đang dùng/i.test(text))

await page.screenshot({ path: process.env.SHOT1 || 'admin-templates.png' })

// Mo hop thoai chi tiet / phan quyen
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Phân quyền/i.test(x.textContent))
  if (b) { b.click(); return true }
  return false
})
check('Mo duoc hop thoai phan quyen', opened)
await new Promise((r) => setTimeout(r, 1200))
const dtext = await page.evaluate(() => document.body.innerText)
check('Hop thoai co muc cap quyen', /Cấp quyền riêng/i.test(dtext))
check('Hop thoai co 3 muc hien thi', /Công khai/.test(dtext) && /Giới hạn/.test(dtext) && /Độc quyền/.test(dtext))
check('Co goi y cap cho CTV = ca nhom khach', /mọi khách của CTV/i.test(dtext))
await page.screenshot({ path: process.env.SHOT2 || 'admin-grants.png' })

const real = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e))
check('Khong co loi JS', real.length === 0, real.slice(0, 2).join(' | '))

console.log(`\n=== ${res.filter(Boolean).length}/${res.length} DAT ===`)
await browser.close()
process.exitCode = res.every(Boolean) ? 0 : 1
