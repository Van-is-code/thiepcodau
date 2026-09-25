// Kiểm thử giao diện bằng Chrome thật (puppeteer-core, dùng Chrome đã cài trên máy).
//   node test/browser.mjs <slug>
import puppeteer from 'puppeteer-core'

// Dùng Chrome đã cài trên máy — dò theo các vị trí cài đặt thường gặp.
import { existsSync } from 'fs'
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const CHROME = CHROME_CANDIDATES.find((c) => { try { return existsSync(c) } catch { return false } })
if (!CHROME) {
  console.error('Khong tim thay Chrome. Dat bien CHROME_PATH tro toi chrome.exe roi chay lai.')
  process.exit(2)
}
const FE = process.env.FE_URL || 'http://localhost:5173'
const SLUG = process.argv[2]

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'DAT   ' : 'TRUOT '} | ${name}${detail ? ' :: ' + detail : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }) // iPhone 14

  const consoleErrors = []
  const failedRequests = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('requestfailed', (r) => failedRequests.push(`${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`))

  // Theo dõi dung lượng ảnh thực sự tải về — đây là con số quyết định thiệp mở nhanh hay chậm.
  const imageLoads = []
  page.on('response', async (res) => {
    const ct = res.headers()['content-type'] || ''
    if (!ct.startsWith('image/')) return
    const len = Number(res.headers()['content-length'] || 0)
    imageLoads.push({ url: res.url(), type: ct, bytes: len, status: res.status() })
  })

  // ---------- 1. Trang đăng nhập ----------
  const t0 = Date.now()
  await page.goto(`${FE}/auth`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('Trang dang nhap mo duoc', true, `${Date.now() - t0}ms`)
  const hasLoginForm = await page.$$eval('input', (els) => els.length >= 2).catch(() => false)
  check('Co o nhap tai khoan/mat khau', hasLoginForm)

  // ---------- 2. Trang thiệp công khai ----------
  const t1 = Date.now()
  await page.goto(`${FE}/${SLUG}`, { waitUntil: 'networkidle2', timeout: 30000 })
  const loadMs = Date.now() - t1
  check('Trang thiep cong khai mo duoc', true, `${loadMs}ms`)

  // ---------- 3. XSS ----------
  await new Promise((r) => setTimeout(r, 1500))
  const frames = page.frames()
  const invFrame = frames.find((f) => f !== page.mainFrame()) || page.mainFrame()
  const xssRan = await invFrame.evaluate(() => Boolean(window.__XSS_RAN)).catch(() => false)
  const title = await page.title()
  check('KHONG chay duoc ma XSS chen qua tieu de thiep', !xssRan && title !== 'PWNED', `title="${title}"`)

  // Dữ liệu vẫn bơm được vào iframe (escape không làm hỏng dữ liệu)
  const dataOk = await invFrame.evaluate(() => Boolean(window.invitationData && window.invitationData.groom_name)).catch(() => false)
  check('Du lieu thiep van bom vao iframe binh thuong', dataOk)

  const groomName = await invFrame.evaluate(() => window.invitationData?.groom_name).catch(() => null)
  check('Ten chu re hien dung', groomName === 'Nguyễn Đức Anh', String(groomName))

  // ---------- 4. Tối ưu ảnh ----------
  const imgInfo = await invFrame.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[data-image], img')]
    return imgs.map((i) => ({
      hasSrcset: Boolean(i.getAttribute('srcset')),
      sizes: i.getAttribute('sizes'),
      loading: i.getAttribute('loading'),
      decoding: i.getAttribute('decoding'),
      priority: i.getAttribute('fetchpriority'),
      w: i.getAttribute('width'), h: i.getAttribute('height'),
    }))
  }).catch(() => [])

  const preloadTag = await invFrame.evaluate(() =>
    Boolean(document.querySelector('link[rel="preload"][as="image"]'))).catch(() => false)
  const preconnectTag = await invFrame.evaluate(() =>
    document.querySelectorAll('link[rel="preconnect"]').length).catch(() => 0)
  check('Co the preload cho anh LCP', preloadTag)
  check('Co preconnect toi host chua anh', preconnectTag > 0, `${preconnectTag} the`)

  const loaderReady = await invFrame.evaluate(() => Boolean(window.__weddingWebImage)).catch(() => false)
  check('Bo tai anh toi uu da nap trong iframe', loaderReady)

  // Định dạng & cỡ ảnh mà trình duyệt THỰC SỰ chọn — đây mới là thước đo thật.
  const support = await invFrame.evaluate(() => window.__weddingWebImage?.support?.()).catch(() => null)
  console.log(`
  trinh duyet ho tro: webp=${support?.webp} avif=${support?.avif}`)

  const srcsetInfo = await invFrame.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[data-image]')]
    return imgs.map((i) => ({
      srcset: (i.getAttribute('srcset') || '').split(',').length,
      currentSrc: i.currentSrc || i.src,
      natural: i.naturalWidth,
      loading: i.getAttribute('loading'),
      priority: i.getAttribute('fetchpriority'),
    }))
  }).catch(() => [])

  check('Anh co srcset nhieu co', srcsetInfo.every((i) => i.srcset >= 2),
    srcsetInfo.map((i) => i.srcset + ' co').join(', '))
  check('Anh dau tien uu tien cao, anh sau lazy-load',
    srcsetInfo[0]?.priority === 'high' && srcsetInfo.slice(1).every((i) => i.loading === 'lazy'),
    srcsetInfo.map((i) => `${i.priority}/${i.loading}`).join(' '))

  // Màn hình 390px DPR2 -> cần ~800px, KHÔNG được tải bản 1920px.
  const oversized = srcsetInfo.filter((i) => i.natural > 1200)
  check('Khong tai anh qua lon so voi man hinh', oversized.length === 0,
    srcsetInfo.map((i) => i.natural + 'px').join(', '))

  for (const i of srcsetInfo) {
    console.log(`    chon: ${String(i.natural).padStart(4)}px  ${String(i.currentSrc).slice(-56)}`)
  }

  const totalImageKB = Math.round(imageLoads.reduce((s, i) => s + i.bytes, 0) / 1024)
  const modern = imageLoads.filter((i) => /avif|webp/.test(i.type)).length
  console.log(`\n  anh da tai: ${imageLoads.length} tep, tong ${totalImageKB}KB, dinh dang moi (avif/webp): ${modern}`)
  for (const i of imageLoads.slice(0, 6)) {
    console.log(`    ${i.status} ${i.type.padEnd(12)} ${String(Math.round(i.bytes / 1024)).padStart(5)}KB  ${i.url.slice(-58)}`)
  }

  // ---------- 5. Lỗi console / request hỏng ----------
  const realErrors = consoleErrors.filter((e) => !/favicon|DevTools/i.test(e))
  check('Khong co loi console', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
  const realFailed = failedRequests.filter((r) => !/favicon/i.test(r))
  check('Khong co request hong', realFailed.length === 0, realFailed.slice(0, 3).join(' | '))

  // ---------- 6. Chụp màn hình ----------
  await page.screenshot({ path: process.env.SHOT_PATH || 'thiep-mobile.png', fullPage: false })
  console.log('\n  da chup man hinh ->', process.env.SHOT_PATH || 'thiep-mobile.png')

  const passed = results.filter((r) => r.pass).length
  console.log(`\n=== KET QUA: ${passed}/${results.length} muc DAT ===`)
  process.exitCode = passed === results.length ? 0 : 1
} finally {
  await browser.close()
}
