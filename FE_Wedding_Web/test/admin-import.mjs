// Kiem luong NHAP THEME qua giao dien: chon file -> phan tich -> bao cao -> nhap that.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
const FE = process.env.FE_URL || 'http://localhost:5173'
const ZIP = process.argv[2]
const res = []
const check = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? 'DAT   ' : 'TRUOT '} | ${n}${d ? ' :: ' + d : ''}`) }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(FE + '/auth', { waitUntil: 'domcontentloaded' })
await page.evaluate(async () => {
  const r = await fetch('http://localhost:3000/api/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  localStorage.setItem('token', (await r.json())?.data?.token || '')
})
await page.goto(FE + '/admin', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1000))
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Quản Lý Mẫu/i.test(x.textContent))?.click())
await new Promise((r) => setTimeout(r, 1000))

// Mo hop thoai nhap theme
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Nhập theme mới/i.test(x.textContent))?.click())
await new Promise((r) => setTimeout(r, 600))
check('Mo duoc hop thoai nhap theme', /Chọn file \.zip/i.test(await page.evaluate(() => document.body.innerText)))

// Chon file zip
const input = await page.$('input[type="file"]')
check('Co o chon file', Boolean(input))
await input.uploadFile(ZIP)
await new Promise((r) => setTimeout(r, 500))

// Bam Phan tich thu
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Phân tích thử/i.test(x.textContent))?.click())
await new Promise((r) => setTimeout(r, 6000))

const t = await page.evaluate(() => document.body.innerText)
check('Co bao cao so truong', /\d+ trường/.test(t), t.match(/\d+ trường/)?.[0])
check('Co bao cao o anh', /\d+ ô ảnh/.test(t), t.match(/\d+ ô ảnh/)?.[0])
check('Bao ro da bo qua anh trang tri', /ảnh trang trí đã bỏ qua/i.test(t), t.match(/\d+ ảnh trang trí đã bỏ qua/)?.[0])
check('Liet ke phan chua nhan ra', /Chưa nhận ra/i.test(t), t.match(/Chưa nhận ra \(\d+\)/)?.[0])
check('Hien o chon de gan tay', (await page.$$('select')).length > 0, (await page.$$('select')).length + ' o chon')
check('Hien form thong tin mau', /Mã mẫu|Tên hiển thị/i.test(t))
check('Hien muc chon quyen', /Ai được dùng mẫu này/i.test(t))

await page.screenshot({ path: process.env.SHOT || 'import.png', fullPage: false })

// Gan tay 1 o roi nhap that
await page.evaluate(() => {
  const sel = document.querySelector('select')
  if (!sel) return
  const opt = [...sel.options].find((o) => /Tên gọi cô dâu/i.test(o.textContent))
  if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })) }
})
await new Promise((r) => setTimeout(r, 400))
check('Gan tay xong hien nut phan tich lai', /Phân tích lại với \d+ ô/i.test(await page.evaluate(() => document.body.innerText)))

// Dat ma mau rieng: tim o nhap theo NHAN "Ma mau" thay vi doan theo gia tri.
const codeSet = await page.evaluate(() => {
  const label = [...document.querySelectorAll('label')].find((l) => /Mã mẫu/i.test(l.textContent))
  const input = label?.querySelector('input')
  if (!input) return null
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'test-ui-import')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input.value
})
check('Dat duoc ma mau', codeSet === 'test-ui-import', String(codeSet))
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Nhập mẫu vào hệ thống/i.test(x.textContent))?.click())
await new Promise((r) => setTimeout(r, 9000))

// Hop thoai xac nhan dang che danh sach -> dong lai roi moi doc man hinh.
const hadAlert = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Đã hiểu|OK|Đóng/i.test(x.textContent))
  if (b) { b.click(); return true }
  return false
})
check('Hien thong bao nhap thanh cong', hadAlert)
await new Promise((r) => setTimeout(r, 2500))

const after = await page.evaluate(() => document.body.innerText)
check('Nhap thanh cong (mau moi xuat hien)', /test-ui-import/i.test(after), after.match(/test-ui-import/i)?.[0] || 'chua thay')
await page.screenshot({ path: process.env.SHOT2 || 'import-done.png' })

check('Khong co loi JS', errors.filter((e) => !/favicon|404/i.test(e)).length === 0, errors.slice(0,2).join(' | '))
console.log(`\n=== ${res.filter(Boolean).length}/${res.length} DAT ===`)
await browser.close()
