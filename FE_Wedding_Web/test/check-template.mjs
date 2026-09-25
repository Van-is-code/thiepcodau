// Mo mau thiep da bom du lieu bang Chrome that, doi chieu tung o da bind.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const CHROME = [process.env.CHROME_PATH,
  [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
].filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
if (!CHROME) { console.error('Khong tim thay Chrome'); process.exit(2) }

const URL_ = process.env.TPL_URL || 'http://localhost:4180/index.html'
const results = []
const check = (name, pass, detail = '') => {
  results.push(pass); console.log(`${pass ? 'DAT   ' : 'TRUOT '} | ${name}${detail ? ' :: ' + detail : ''}`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 40000 })
// Doi cac script defer + cau noi tai bom chay xong
await new Promise((r) => setTimeout(r, 1800))

// --- Du lieu that da vao DOM chua ---
const txt = async (sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null)

check('Ten co dau (hero)',      await txt('.hero-name[data-field="bride_short_name"]') === 'Vân', await txt('.hero-name[data-field="bride_short_name"]'))
check('Ten chu re (hero)',      await txt('.hero-name[data-field="groom_short_name"]') === 'Anh', await txt('.hero-name[data-field="groom_short_name"]'))
check('Ho ten day du chu re',   await txt('[data-field="groom_name"]') === 'Nguyễn Đức Anh', await txt('[data-field="groom_name"]'))
check('Ho ten day du co dau',   await txt('[data-field="bride_name"]') === 'Phạm Thanh Vân', await txt('[data-field="bride_name"]'))
check('Cha chu re',             await txt('[data-field="groom.father_grom"]') === 'Ông: Nguyễn Văn Hùng', await txt('[data-field="groom.father_grom"]'))
check('Me co dau',              await txt('[data-field="bride.mother_bride"]') === 'Bà: Lê Thị Hoa', await txt('[data-field="bride.mother_bride"]'))
check('Dia chi le thanh hon',   (await txt('[data-field="venue_address"]') || '').includes('Lê Hồng Phong'), await txt('[data-field="venue_address"]'))
check('Am lich le',             (await txt('[data-field="ceremony_lunar_text"]') || '').includes('Đinh Mùi'), await txt('[data-field="ceremony_lunar_text"]'))
check('Loi cam on (chan trang)',(await txt('[data-field="thank_you_message"]') || '').includes('dành thời gian'), (await txt('[data-field="thank_you_message"]') || '').slice(0, 42))
check('Moc timeline 2',         await txt('[data-field="timeline_title_2"]') === 'Làm Lễ', await txt('[data-field="timeline_title_2"]'))
check('Gio timeline 2',         await txt('[data-field="timeline_time_2"]') === '17:30', await txt('[data-field="timeline_time_2"]'))

// --- Ngay thang tinh tu ceremony_date ---
const short = await txt('.hero-date-val')
check('Ngay cuoi lay tu ceremony_date', short === '20.11.2027', short)

// --- Khoi "Ngay moi" (tiec) — modals.js tung ghi de cho nay ---
const ngayMoi = await txt('#invitation-time-val')
check('Khoi Ngay moi dung du lieu tiec', (ngayMoi || '').includes('21.11.2027'), ngayMoi)
// modals.js tung thay sach textContent -> xoa mat cac o [data-field], khien che do
// sua khong bam vao duoc. Kiem tra cac o van con nguyen sau khi no chay.
const conOSua = await page.$$eval('#invitation-time-val [data-field]', (els) => els.map((e) => e.getAttribute('data-field'))).catch(() => [])
check('Khoi Ngay moi van con o de sua tai cho', conOSua.length === 3, conOSua.join(', ') || 'khong con o nao')
check('Gio tiec lay tu reception_time', (ngayMoi || '').startsWith('18:00'), ngayMoi)
const diaChiTiec = await txt('#invitation-address-val')
check('Dia chi tiec dung', (diaChiTiec || '').includes('Hoàng Gia'), diaChiTiec)

// --- Dem nguoc phai tinh theo ngay cuoi that, khong phai 2025 demo ---
const iso = await page.evaluate(() => window.weddingData?.eventTime?.isoDateTime)
check('Dong ho dem nguoc theo ngay that', String(iso).startsWith('2027-11-20'), iso)

// --- Link chi duong ---
const mapLe = await page.$eval('[data-field-href="map_url"]', (e) => e.getAttribute('href')).catch(() => null)
check('Link chi duong le', (mapLe || '').includes('Le+Hong+Phong'), mapLe)
const mapTiec = await page.$eval('[data-field-href="reception_map_url"]', (e) => e.getAttribute('href')).catch(() => null)
check('Link chi duong tiec', (mapTiec || '').includes('Hoang+Gia'), mapTiec)

// --- Khong con du lieu demo sot lai ---
const body = await page.evaluate(() => document.body.innerText)
const leftovers = ['Minh Anh', 'Hoàng Nam', 'The Luxe', 'Nguyễn Văn Cừ', '26.04.2025', '26 · 04 · 2025']
  .filter((t) => body.includes(t))
check('Khong con du lieu demo hien ra', leftovers.length === 0, leftovers.join(' | ') || 'sach')

check('Khong co loi JS', errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '))

await page.screenshot({ path: process.env.SHOT || 'tpl.png', fullPage: false })
console.log('\nanh chup ->', process.env.SHOT || 'tpl.png')
const pass = results.filter(Boolean).length
console.log(`\n=== ${pass}/${results.length} muc DAT ===`)
await browser.close()
process.exitCode = pass === results.length ? 0 : 1
