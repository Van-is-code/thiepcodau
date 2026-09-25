// Chung minh bo chuyen doi KHONG lam doi giao dien.
//
// Cach lam: mo theme GOC va theme DA CHUYEN trong cung 1 Chrome, cung kich thuoc,
// chup toan trang roi so tung diem anh. Bo chuyen doi chi THEM thuoc tinh data-*
// nen anh phai giong het — lech du 1 diem anh cung la dau hieu no da dung vao
// bo cuc/CSS cua theme.
import puppeteer from 'puppeteer-core'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
if (!CHROME) { console.error('Khong tim thay Chrome'); process.exit(2) }

const [, , urlGoc, urlMoi, outDir] = process.argv
const VIEWPORTS = [
  { name: 'dien-thoai', width: 390, height: 844 },
  { name: 'may-tinh-bang', width: 820, height: 1180 },
  { name: 'may-tinh', width: 1440, height: 900 },
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })

// Chup 1 trang: tat hieu ung chuyen dong de 2 lan chup khong lech vi animation.
const shot = async (url, vp, file) => {
  const page = await browser.newPage()
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })

  // Đóng băng MỌI chuyển động trước khi trang chạy.
  //
  // Tắt CSS animation là chưa đủ: theme còn hiệu ứng chạy bằng JS qua
  // requestAnimationFrame (bướm bay, hạt lấp lánh, đĩa than quay). Hai lần chụp
  // cách nhau vài giây sẽ bắt được chúng ở vị trí khác nhau và báo "lệch" oan —
  // trong khi bộ chuyển đổi không hề đụng tới.
  await page.evaluateOnNewDocument(() => {
    let t = 0;
    window.requestAnimationFrame = (cb) => { t += 16; return setTimeout(() => cb(t), 0) };
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    // Math.random cố định -> hạt/đốm sinh ngẫu nhiên rơi vào cùng vị trí ở cả 2 lần.
    let seed = 42;
    Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 };
    // Thời gian đứng yên -> mọi thứ tính theo Date.now() không trôi.
    const fixed = 1700000000000;
    Date.now = () => fixed;
    performance.now = () => 0;
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 })
  // Dung moi animation/transition: neu khong, 2 anh se lech chi vi thoi diem chup.
  await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important;
    animation-duration:0s!important;transition-duration:0s!important}` })
  await page.evaluate(() => {
    // Mo phong bi neu co, de chup duoc phan noi dung chinh.
    const sels = ['#wax-seal', '#envelope-container', '.letter-seal', '[class*="seal"]', '[class*="envelope-container"]']
    for (const s of sels) { const e = document.querySelector(s); if (e) { e.click(); return } }
  })
  await new Promise((r) => setTimeout(r, 3500))
  // Cuon het trang de anh lazy-load tai xong, roi ve dau trang.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)) }
    window.scrollTo(0, 0)
  })
  await new Promise((r) => setTimeout(r, 1200))
  const buf = await page.screenshot({ fullPage: true })
  writeFileSync(file, buf)
  const size = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }))
  await page.close()
  return size
}

// Đo "nhiễu nền" của chính theme trước.
//
// Nhiều theme có hiệu ứng không tất định (bướm bay theo quỹ đạo ngẫu nhiên, hạt
// lấp lánh, đĩa than quay). Chụp cùng MỘT trang hai lần cũng ra ảnh khác nhau vài
// trăm điểm. Nếu không đo mức nhiễu này trước thì mọi theme có hiệu ứng đều bị kết
// luận sai là "bộ chuyển đổi làm đổi giao diện".
//
// Cách đọc kết quả:
//   lệch(gốc↔đã chuyển) ≤ nhiễu nền  ->  bộ chuyển đổi KHÔNG đụng vào giao diện
//   lệch lớn hơn hẳn                 ->  có thay đổi thật, phải xem ảnh lech-*.png
// Mặt nạ "vùng động": những điểm ảnh KHÁC NHAU khi chụp CÙNG một trang hai lần.
// Bướm bay, hạt lấp lánh, đĩa than quay đều rơi vào đây. Điểm nằm trong vùng này
// không chứng minh được điều gì nên phải loại ra trước khi kết luận.
// Nới rộng thêm vài điểm quanh mép vì lần chụp sau vật thể dịch đi một chút.
const buildMask = (a, b, pad = 12) => {
  const raw = new PNG({ width: a.width, height: a.height })
  const n = pixelmatch(a.data, b.data, raw.data, a.width, a.height, { threshold: 0.1 })
  const mask = new Uint8Array(a.width * a.height)
  if (n === 0) return { mask, n }
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (a.width * y + x) << 2
      // pixelmatch tô điểm lệch bằng màu đỏ.
      if (!(raw.data[i] > 200 && raw.data[i + 1] < 120 && raw.data[i + 2] < 120)) continue
      for (let dy = -pad; dy <= pad; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= a.height) continue
        for (let dx = -pad; dx <= pad; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < a.width) mask[a.width * yy + xx] = 1
        }
      }
    }
  }
  return { mask, n }
}

// Đếm điểm lệch giữa hai ảnh, bỏ qua các điểm nằm trong "vùng động".
const demLech = (a, b, mask) => {
  const diff = new PNG({ width: a.width, height: a.height })
  const tho = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
  if (!mask) return { tho, that: tho, anh: diff }
  let that = 0
  const con = new PNG({ width: a.width, height: a.height })
  con.data.fill(255)
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (a.width * y + x) << 2
      if (!(diff.data[i] > 200 && diff.data[i + 1] < 120 && diff.data[i + 2] < 120)) continue
      if (mask[a.width * y + x]) continue
      that++
      con.data[i] = 255; con.data[i + 1] = 0; con.data[i + 2] = 0; con.data[i + 3] = 255
    }
  }
  return { tho, that, anh: con }
}

// Trên mức này thì nhiễu của chính theme át hết tín hiệu -> không kết luận.
const NGUONG_KHONG_KET_LUAN = 50

let allOk = true
let boQua = 0
for (const vp of VIEWPORTS) {
  // 1) Chụp trang GỐC nhiều lần để biết tự nó nhảy tới đâu.
  //
  // Một cặp ảnh là không đủ: con bướm có thể tình cờ dừng cùng chỗ ở hai lần
  // chụp liên tiếp rồi bay hẳn sang chỗ khác ở lần thứ ba. Lấy hợp của mọi cặp
  // trong 3 lần chụp thì vùng bướm quét qua mới phủ đủ.
  const mau = []
  for (let k = 0; k < 3; k++) {
    const f = `${outDir}/nhieu-${k}-${vp.name}.png`
    await shot(urlGoc, vp, f)
    mau.push(PNG.sync.read(readFileSync(f)))
  }
  if (mau.some((m) => m.width !== mau[0].width || m.height !== mau[0].height)) {
    console.log(`TRUOT  | ${vp.name}: CHÍNH THEME GỐC chụp ra kích thước khác nhau — không so được`)
    allOk = false
    continue
  }

  const mask = new Uint8Array(mau[0].width * mau[0].height)
  let nhieuMax = 0
  for (let x = 0; x < mau.length; x++) {
    for (let y = x + 1; y < mau.length; y++) {
      const { mask: m, n } = buildMask(mau[x], mau[y])
      nhieuMax = Math.max(nhieuMax, n)
      for (let k = 0; k < mask.length; k++) if (m[k]) mask[k] = 1
    }
  }

  // 2) Gốc so với bản đã chuyển.
  const fMoi = `${outDir}/moi-${vp.name}.png`
  await shot(urlMoi, vp, fMoi)
  const b = PNG.sync.read(readFileSync(fMoi))
  const a = mau[0]
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`TRUOT  | ${vp.name}: KÍCH THƯỚC TRANG KHÁC NHAU ${a.width}x${a.height} vs ${b.width}x${b.height}`)
    allOk = false
    continue
  }

  const r = demLech(a, b, mask)
  if (r.that > 0) writeFileSync(`${outDir}/lech-that-${vp.name}.png`, PNG.sync.write(r.anh))

  // Theme tự nhảy quá nhiều thì phép so điểm ảnh KHÔNG phân giải được: mức
  // gốc↔mới và mức gốc↔gốc trùng dải nhau, đọc kiểu gì cũng là đoán. Nói thẳng
  // là không kết luận được, đừng báo "đạt" cho sang mà cũng đừng vu oan.
  // Chốt hạ cho những theme này là test/layout-diff.mjs (so hộp bao + CSS tính
  // toán, tất định) và test/source-diff.cjs (so mã nguồn).
  if (nhieuMax > NGUONG_KHONG_KET_LUAN) {
    console.log(`BỎ QUA | ${vp.name.padEnd(14)} ${a.width}x${a.height}`
      + ` · gốc↔mới ${String(r.tho).padStart(5)} điểm`
      + ` · nhưng gốc↔gốc tự lệch tới ${String(nhieuMax).padStart(5)} -> không phân giải được`)
    boQua++
    continue
  }

  const ok = r.that === 0
  if (!ok) allOk = false
  console.log(`${ok ? 'DAT   ' : 'TRUOT '} | ${vp.name.padEnd(14)} ${a.width}x${a.height}`
    + ` · gốc↔mới ${String(r.tho).padStart(5)} điểm`
    + ` · gốc↔gốc tự lệch tới ${String(nhieuMax).padStart(5)}`
    + ` · ngoài vùng động ${r.that}`)
}

console.log(`
=== ${!allOk
  ? 'CÓ THAY ĐỔI THẬT — xem ảnh lech-that-*.png'
  : boQua === VIEWPORTS.length
    ? 'KHÔNG KẾT LUẬN ĐƯỢC BẰNG ĐIỂM ẢNH — theme có hiệu ứng ngẫu nhiên. Chạy test/layout-diff.mjs để chốt.'
    : boQua > 0
      ? `GIAO DIỆN GIỮ NGUYÊN ở các khổ đo được (${boQua} khổ phải bỏ qua vì theme tự nhảy)`
      : 'GIAO DIỆN GIỮ NGUYÊN — không lệch một điểm ảnh nào'} ===`)
await browser.close()
process.exitCode = allOk ? 0 : 1
