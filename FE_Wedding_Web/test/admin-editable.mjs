// Kiem luong: tai theme len -> MO PREVIEW that -> tich chon nguoi dung duoc sua gi
// -> nhap vao he thong -> kiem tra dung quyen da chon (ca giao dien lan BE).
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
const FE = process.env.FE_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://localhost:3000'
const ZIP = process.argv[2]
const CODE = process.env.CODE || 'test-quyen-sua'

const res = []
const check = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? 'DAT   ' : 'TRUOT '} | ${n}${d ? ' :: ' + d : ''}`) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(FE + '/auth', { waitUntil: 'domcontentloaded' })
const token = await page.evaluate(async (api) => {
  const r = await fetch(api + '/api/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const t = (await r.json())?.data?.token || ''
  localStorage.setItem('token', t)
  return t
}, API)
check('Dang nhap admin', Boolean(token))

// Don mau cu cua lan chay truoc de chay lai duoc nhieu lan.
await page.evaluate(async (api, code, tk) => {
  const r = await fetch(`${api}/api/admin/templates/manage?search=${code}`, { headers: { Authorization: 'Bearer ' + tk } })
  const list = (await r.json())?.data?.items || []
  for (const t of list) {
    if (t.template_code === code) {
      await fetch(`${api}/api/admin/templates/manage/${t.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } })
    }
  }
}, API, CODE, token)

await page.goto(FE + '/admin', { waitUntil: 'networkidle2' })
await wait(1000)
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Quản Lý Mẫu/i.test(x.textContent))?.click())
await wait(1000)
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Nhập theme mới/i.test(x.textContent))?.click())
await wait(600)

const input = await page.$('input[type="file"]')
await input.uploadFile(ZIP)
await wait(500)
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Phân tích thử/i.test(x.textContent))?.click())
await wait(9000)

// ---------- 1) PREVIEW THAT ----------
const tabs = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()))
check('Co 3 tab sau khi phan tich',
  tabs.some((t) => /Xem trước thiệp/.test(t)) && tabs.some((t) => /Kết quả dò trường/.test(t))
  && tabs.some((t) => /Cho khách sửa gì/.test(t)))

const frameInfo = await page.evaluate(() => {
  const f = document.querySelector('iframe[title="Xem trước theme"]')
  return f ? { src: f.getAttribute('src'), w: f.clientWidth } : null
})
check('Mo san khung xem truoc', Boolean(frameInfo), frameInfo?.src || '')
check('Duong dan tro vao ban tam', /\/templates\/_preview\/[0-9a-f]{32}\//.test(frameInfo?.src || ''), frameInfo?.src || '')

// Ban xem truoc do BE phuc vu (khac origin voi FE) nen khong doc duoc qua
// contentDocument. Mo hang ngay URL do o tab rieng de xem no render that khong.
await wait(3000)
const tabXem = await browser.newPage()
await tabXem.goto(frameInfo.src, { waitUntil: 'networkidle2', timeout: 40000 })
await wait(2500)
const inside = await tabXem.evaluate(() => ({
  chu: (document.body.textContent || '').replace(/\s+/g, ' ').trim().length,
  o: document.querySelectorAll('[data-field]').length,
  anh: document.querySelectorAll('img').length,
  // Bo qua the img rong cua chinh theme (o cho lightbox, JS moi do anh vao khi bam).
  anhHong: [...document.querySelectorAll('img')]
    .filter((i) => (i.getAttribute('src') || '').trim() && i.complete && i.naturalWidth === 0).length,
}))
await tabXem.close()
check('Thiep trong khung hien ra that', (inside.chu || 0) > 200, JSON.stringify(inside))
check('Thiep da duoc gan o du lieu', (inside.o || 0) > 10, (inside.o || 0) + ' o data-field')
check('Anh trong ban xem truoc tai duoc het', inside.anhHong === 0, inside.anhHong + '/' + inside.anh + ' anh hong')

await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Điện thoại')?.click())
await wait(600)
const wPhone = await page.evaluate(() => document.querySelector('iframe[title="Xem trước theme"]')?.offsetWidth)
check('Doi duoc khung sang dien thoai', wPhone === 390, String(wPhone))
await page.screenshot({ path: process.env.SHOT1 || 'preview.png' })

// ---------- 2) TICH CHON QUYEN SUA ----------
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Cho khách sửa gì/.test(x.textContent))?.click())
await wait(900)
const picker = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('input[type="checkbox"]')]
  return {
    tong: boxes.length,
    daTich: boxes.filter((b) => b.checked).length,
    khoa: boxes.filter((b) => b.disabled).length,
    chu: document.body.innerText,
  }
})
check('Hien bang tich chon', picker.tong > 5, picker.tong + ' o tich')
check('Mac dinh la bo mac dinh he thong', /mặc định/i.test(picker.chu))
const coNganHang = await page.evaluate(() => /Ngân hàng|Số TK|Chủ TK/i.test(document.body.innerText))
check('Khoa o ngan hang (neu theme co)', coNganHang ? picker.khoa > 0 : picker.khoa === 0,
  coNganHang ? picker.khoa + ' o bi khoa' : 'theme nay khong co truong ngan hang')
check('Co tuy chon album tai them anh', /tải thêm|Tối đa/i.test(picker.chu))
await page.screenshot({ path: process.env.SHOT2 || 'picker.png' })

// Bung het cac nhom de thay du o tich (mac dinh chi mo vai nhom).
// Chi bam nhom DANG DONG, khong bam nhom dang mo keo lai dong mat.
const soNhom = await page.evaluate(() => {
  const nut = [...document.querySelectorAll('button[aria-expanded]')]
  document.evaluate('//button[text()]', document, null, 0, null)
  ;[...document.querySelectorAll('button')].find((b) => /Mở hết nhóm/.test(b.textContent))?.click()
  return nut.length
})
await wait(600)
const truocKhiBo = await page.evaluate(() =>
  [...document.querySelectorAll('input[type="checkbox"][data-field-key]')].length)
check('Bung duoc het cac nhom', truocKhiBo >= 20, soNhom + ' nhom, ' + truocKhiBo + ' o truong')

// Bo het roi chi tich dung 2 o CO THAT trong theme nay.
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Bỏ hết/.test(x.textContent))?.click())
await wait(500)
const daChon = await page.evaluate(() => {
  const o = [...document.querySelectorAll('input[type="checkbox"][data-field-key]')].filter((b) => !b.disabled)
  const chon = o.slice(0, 2)
  chon.forEach((b) => { if (!b.checked) b.click() })
  return {
    khoa: chon.map((b) => b.dataset.fieldKey),
    tich: [...document.querySelectorAll('input[type="checkbox"][data-field-key]')].filter((b) => b.checked).length,
  }
})
check('Tich dung 2 o', daChon.tich === 2, JSON.stringify(daChon))
const MONG_DOI = daChon.khoa

// Bat cho album tai them anh, gioi han 12 tam.
const albumOk = await page.evaluate(() => {
  const hang = [...document.querySelectorAll('*')].find((e) => /Album ảnh/.test(e.textContent)
    && e.querySelector('input[type="number"]'))
  if (!hang) return null
  const so = hang.querySelector('input[type="number"]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(so, '12')
  so.dispatchEvent(new Event('input', { bubbles: true }))
  return so.value
})
check('Dat duoc so anh toi da cho album', albumOk === '12', String(albumOk))

// ---------- 3) NHAP THAT ----------
await page.evaluate((code) => {
  const label = [...document.querySelectorAll('label')].find((l) => /Mã mẫu/i.test(l.textContent))
  const input = label?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, code)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, CODE)
await wait(400)
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Nhập mẫu vào hệ thống/i.test(x.textContent))?.click())
await wait(12000)
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Đã hiểu|OK|Đóng/i.test(x.textContent))?.click())
await wait(2500)

// ---------- 4) KIEM O BE ----------
const tpl = await page.evaluate(async (api, code, tk) => {
  const r = await fetch(`${api}/api/admin/templates/manage?search=${code}`, { headers: { Authorization: 'Bearer ' + tk } })
  const list = (await r.json())?.data?.items || []
  const t = list.find((x) => x.template_code === code)
  if (!t) return null
  const d = await fetch(`${api}/api/admin/templates/manage/${t.id}`, { headers: { Authorization: 'Bearer ' + tk } })
  return (await d.json())?.data || null
}, API, CODE, token)
check('Mau da vao he thong', Boolean(tpl), tpl?.template_code || 'khong thay')
check('BE luu dung 2 truong duoc sua', Array.isArray(tpl?.editable_fields) && tpl.editable_fields.length === 2,
  JSON.stringify(tpl?.editable_fields))
check('Dung 2 truong da tich', MONG_DOI.every((k) => (tpl?.editable_fields || []).includes(k)),
  'mong ' + JSON.stringify(MONG_DOI) + ' -> luu ' + JSON.stringify(tpl?.editable_fields))
check('BE luu luat album 12 anh',
  (tpl?.image_slot_rules?.gallery?.max ?? null) === 12, JSON.stringify(tpl?.image_slot_rules))
check('Trang chi tiet co danh muc de sua lai quyen', Boolean(tpl?.catalog?.fields?.length),
  (tpl?.catalog?.fields || []).length + ' truong')

// Ban tam phai bi don sau khi nhap.
const conBanTam = await page.evaluate(async (src) => {
  try { const r = await fetch(src); return r.status } catch (e) { return 'loi' }
}, frameInfo?.src || '')
check('Ban xem truoc da bi don sau khi nhap', conBanTam === 404, 'HTTP ' + conBanTam)

check('Khong co loi JS', errors.filter((e) => !/favicon|404/i.test(e)).length === 0, errors.slice(0, 2).join(' | '))
console.log(`\n=== ${res.filter(Boolean).length}/${res.length} DAT ===`)
await browser.close()
process.exitCode = res.every(Boolean) ? 0 : 1
