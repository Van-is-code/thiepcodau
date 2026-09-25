// Kiem tra cac o [data-image] da nhan dung anh chu thiep tai len.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })

const res = []
const check = (n, ok, d='') => { res.push(ok); console.log(`${ok?'DAT   ':'TRUOT '} | ${n}${d?' :: '+d:''}`) }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.goto(process.env.TPL_URL || 'http://localhost:4180/index.html', { waitUntil: 'networkidle2', timeout: 40000 })
// Mo phong bi de cac phan ben trong duoc bo tri (anh lazy can thay man hinh)
await page.evaluate(() => { const s = document.getElementById('wax-seal'); if (s) s.click() })
await new Promise((r) => setTimeout(r, 3000))
// Cuon het trang de kich hoat lazy-load
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)) }
})
await new Promise((r) => setTimeout(r, 1500))

const info = await page.evaluate(() => [...document.querySelectorAll('[data-image]')].map((e) => ({
  type: e.getAttribute('data-image'),
  idx: e.getAttribute('data-image-index'),
  tag: e.tagName,
  src: (e.currentSrc || e.src || getComputedStyle(e).backgroundImage || '').slice(0, 30),
  srcsetCount: (e.getAttribute('srcset') || '').split(',').filter(Boolean).length,
  loading: e.getAttribute('loading'),
  priority: e.getAttribute('fetchpriority'),
  natural: e.naturalWidth || 0,
})))

console.log(`\n  tong ${info.length} o anh:`)
for (const i of info) console.log(`    ${String(i.type).padEnd(9)} idx=${String(i.idx ?? '-').padEnd(3)} ${i.tag.padEnd(4)} srcset=${String(i.srcsetCount).padEnd(2)} ${String(i.loading||'-').padEnd(6)} ${String(i.priority||'-').padEnd(5)} ${i.natural}px`)

// O QR rong bi AN co chu dich (xem kiem tra an toan QR ben duoi) -> khong tinh vao day.
const canHaveImage = info.filter((i) => !(i.type === 'bank_qr' && i.srcsetCount === 0))
const withData = canHaveImage.filter((i) => i.srcsetCount > 0 || i.natural > 0)
check('Moi o anh co du lieu deu nhan duoc anh', withData.length === canHaveImage.length, `${withData.length}/${canHaveImage.length}`)
check('Anh co srcset nhieu co', info.filter(i => i.srcsetCount >= 4).length >= 9, `${info.filter(i=>i.srcsetCount>=4).length} o co >=4 co`)
check('Anh bia uu tien cao', info.some((i) => i.type === 'cover' && i.priority === 'high'), info.find(i=>i.type==='cover')?.priority)
check('Anh album lazy-load', info.filter(i => i.type==='gallery').every(i => i.loading === 'lazy'), info.filter(i=>i.type==='gallery').map(i=>i.loading).join(','))
check('Khong tai ban qua lon (man 390px)', info.every((i) => i.natural === 0 || i.natural <= 1280), [...new Set(info.map(i=>i.natural))].join(','))

// AN TOAN TIEN BAC: o QR chua co ma that phai bi AN, tuyet doi khong duoc de lai
// ma QR mau cua goi template (do la so tai khoan co that cua nguoi khac).
const qrTrong = await page.evaluate(() => [...document.querySelectorAll('[data-image="bank_qr"]')]
  .map((e) => ({ hienThi: getComputedStyle(e).display !== 'none', coSrc: Boolean(e.getAttribute('src')) })))
const qrLoRa = qrTrong.filter((q) => q.hienThi && q.coSrc).length
check('O QR chua co ma that bi an di', qrLoRa === 1,
  `${qrTrong.length} o QR, ${qrLoRa} o dang hien anh (chi duoc 1 o co ma that)`)

await page.evaluate(() => window.scrollTo(0, 0))
await new Promise((r) => setTimeout(r, 400))
const out = process.env.OUT_DIR || '.'
for (const id of ['hero','couple','story','gallery']) {
  const ok = await page.evaluate((s) => { const e=document.getElementById(s); if(!e) return false; e.scrollIntoView({block:'start'}); return true }, id)
  if (!ok) continue
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: `${out}/img-${id}.png` })
}
const pass = res.filter(Boolean).length
console.log(`\n=== ${pass}/${res.length} muc DAT ===`)
await browser.close()
process.exitCode = pass === res.length ? 0 : 1
