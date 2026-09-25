// So BỐ CỤC giữa theme gốc và theme đã chuyển — phép đo TẤT ĐỊNH.
//
// Ảnh chụp có nhiễu vì theme dùng hiệu ứng động, nên đếm điểm ảnh không phải thước
// đo đáng tin. Ở đây so trực tiếp thứ quyết định giao diện: vị trí, kích thước và
// các thuộc tính CSS đã tính của TỪNG phần tử. Hai con số này không phụ thuộc thời
// điểm chụp, nên lệch là lệch thật.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
const [, , urlGoc, urlMoi] = process.argv
const VIEWPORTS = [
  { name: 'dien-thoai', width: 390, height: 844 },
  { name: 'may-tinh-bang', width: 820, height: 1180 },
  { name: 'may-tinh', width: 1440, height: 900 },
]

// Các thuộc tính quyết định "trông như thế nào".
const PROPS = ['display','position','width','height','margin','padding','border','borderRadius',
  'color','backgroundColor','backgroundImage','fontSize','fontFamily','fontWeight','lineHeight',
  'textAlign','opacity','zIndex','flexDirection','justifyContent','alignItems','gridTemplateColumns',
  'overflow','visibility','boxShadow','letterSpacing','textTransform']

const snapshot = async (browser, url, vp) => {
  const page = await browser.newPage()
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })

  // Đóng băng thời gian TRƯỚC khi trang chạy.
  //
  // Thiệp nào cũng có đồng hồ đếm ngược. Chụp hai bản cách nhau vài giây thì số
  // giây đã khác, chữ số rộng hơn vài phần mười px -> báo "lệch bố cục" oan.
  // Ghim Date.now/rAF/Math.random để hai bản chạy trên cùng một mốc thời gian.
  await page.evaluateOnNewDocument(() => {
    const fixed = 1700000000000
    const RealDate = Date
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fixed])) }
      static now() { return fixed }
    }
    performance.now = () => 0
    let t = 0
    window.requestAnimationFrame = (cb) => { t += 16; return setTimeout(() => cb(t), 0) }
    window.cancelAnimationFrame = (id) => clearTimeout(id)
    let seed = 42
    Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  })

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 })
  // Tắt chuyển động để hình học không đang ở giữa chừng một animation.
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.evaluate(() => {
    const sels = ['#wax-seal','#envelope-container','.letter-seal','[class*="seal"]']
    for (const s of sels) { const e = document.querySelector(s); if (e) { e.click(); return } }
  })
  await new Promise((r) => setTimeout(r, 3000))

  const data = await page.evaluate((props) => {
    const out = []
    const all = document.querySelectorAll('body *')
    for (const el of all) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const style = {}
      for (const p of props) {
        // Bỏ phần origin trong URL: hai bản được phục vụ ở hai cổng khác nhau nên
        // url("http://localhost:4192/...") vs 4193 là khác biệt GIẢ, không phải
        // thay đổi giao diện.
        style[p] = String(cs[p]).replace(/https?:\/\/[^/"')]+/g, '')
      }
      out.push({
        tag: el.tagName,
        cls: el.className && typeof el.className === 'string' ? el.className : '',
        // Làm tròn 0.5px: sai số phụ subpixel của trình duyệt không phải thay đổi thật.
        box: [Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2],
        style,
      })
    }
    return { els: out, docH: document.body.scrollHeight, docW: document.body.scrollWidth }
  }, PROPS)
  await page.close()
  return data
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
let ok = true

// So 2 ảnh chụp, trả về tập chỉ số phần tử khác nhau.
const diffIndexes = (a, b) => {
  const box = new Set()
  const style = new Set()
  const n = Math.min(a.els.length, b.els.length)
  for (let i = 0; i < n; i++) {
    const x = a.els[i], y = b.els[i]
    if (x.box.join() !== y.box.join()) box.add(i)
    for (const p of PROPS) {
      if (x.style[p] !== y.style[p]) { style.add(i); break }
    }
  }
  return { box, style }
}

for (const vp of VIEWPORTS) {
  // Chụp bản GỐC hai lần để biết phần tử nào TỰ nó đã khác giữa hai lần chạy —
  // đó là phần tử có hiệu ứng động (bướm bay, hạt rơi). Chúng không thể dùng để
  // kết luận điều gì về bộ chuyển đổi, nên loại ra khỏi phép so.
  const goc1 = await snapshot(browser, urlGoc, vp)
  const goc2 = await snapshot(browser, urlGoc, vp)
  const dong = diffIndexes(goc1, goc2)

  const moi = await snapshot(browser, urlMoi, vp)
  const that = diffIndexes(goc1, moi)

  // Chỉ giữ lại khác biệt ở phần tử TĨNH.
  const boxThat = [...that.box].filter((i) => !dong.box.has(i))
  const styleThat = [...that.style].filter((i) => !dong.style.has(i))

  const problems = []
  if (goc1.docW !== moi.docW) problems.push(`chiều rộng trang: ${goc1.docW} -> ${moi.docW}`)
  // Chiều cao có thể đổi vài px do phần tử động ở cuối trang -> chỉ báo khi lệch đáng kể.
  if (Math.abs(goc1.docH - moi.docH) > 4) problems.push(`chiều cao trang: ${goc1.docH} -> ${moi.docH}`)
  if (goc1.els.length !== moi.els.length) problems.push(`số phần tử: ${goc1.els.length} -> ${moi.els.length}`)
  if (boxThat.length) problems.push(`${boxThat.length} phần tử tĩnh lệch vị trí/kích thước`)
  if (styleThat.length) problems.push(`${styleThat.length} phần tử tĩnh lệch CSS`)

  const pass = problems.length === 0
  if (!pass) ok = false
  console.log(`${pass ? 'DAT   ' : 'TRUOT '} | ${vp.name.padEnd(14)} ${goc1.els.length} phần tử · ${goc1.docW}x${goc1.docH}`
    + ` · ${dong.box.size + dong.style.size} phần tử động đã loại`
    + (pass ? ' · phần tĩnh GIỐNG HỆT' : ' · ' + problems.join(' | ')))

  for (const i of boxThat.slice(0, 3)) {
    console.log(`         ${goc1.els[i].tag}.${goc1.els[i].cls.slice(0, 26)} hộp ${goc1.els[i].box.join(',')} -> ${moi.els[i].box.join(',')}`)
  }
  for (const i of styleThat.slice(0, 3)) {
    const p = PROPS.find((k) => goc1.els[i].style[k] !== moi.els[i].style[k])
    console.log(`         ${goc1.els[i].tag}.${goc1.els[i].cls.slice(0, 26)} ${p}: ${goc1.els[i].style[p]} -> ${moi.els[i].style[p]}`)
  }
}

console.log(`
=== ${ok ? 'BỐ CỤC GIỮ NGUYÊN 100% — bộ chuyển đổi chỉ thêm thuộc tính, không đụng giao diện'
  : 'CÓ THAY ĐỔI BỐ CỤC THẬT'} ===`)
await browser.close()
process.exitCode = ok ? 0 : 1
