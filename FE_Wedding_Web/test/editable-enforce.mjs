// Kiem CHOT: o KHONG duoc tich thi khong sua duoc that.
//   - BE phai tu choi, tra ve blocked_fields, gia tri cu giu nguyen
//   - Trinh sua khong cho bam vao o do
// Chay sau test/admin-editable.mjs (dung mau ma no vua tao).
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const CHROME = [process.env.CHROME_PATH, [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/')]
  .filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } })
const FE = process.env.FE_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://localhost:3000'
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

// Dung tai khoan admin de dung du lieu, nhung khi SUA thi gia lam nguoi dung
// thuong: admin duoc phep vuot quyen nen test bang admin se khong chung minh gi.
const setup = await page.evaluate(async (api, code) => {
  const dn = async (u, p) => {
    const r = await fetch(api + '/api/users/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    const j = await r.json()
    return j?.data?.token || null
  }
  const admin = await dn('admin', 'admin123')

  // Tai khoan khach thuong de thu sua (dang ky cong khai dang dong -> admin tao).
  const user = 'kh-quyen-' + Date.now().toString(36)
  const pass = 'MatKhau!2026xyz'
  const mk = await fetch(api + '/api/admin/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + admin },
    body: JSON.stringify({ username: user, password: pass, full_name: 'Khach Thu Quyen', slot: 5 }),
  })
  const mkJson = await mk.json()
  const tokenUser = await dn(user, pass)
  if (!tokenUser) return { loi: 'khong tao duoc tai khoan thu: ' + JSON.stringify(mkJson).slice(0, 200) }

  // Lay mau vua nhap.
  const tr = await fetch(`${api}/api/admin/templates/manage?search=${code}`, { headers: { Authorization: 'Bearer ' + admin } })
  const tpl = ((await tr.json())?.data?.items || []).find((x) => x.template_code === code)
  if (!tpl) return { loi: 'khong thay mau ' + code }

  // Bat mau len, cho cong khai, va dat quyen sua ve bo BIET TRUOC.
  // Chi tich 'thank_you_message' — day la cot luu that trong bang invitations
  // nen sua duoc hay khong la thay ngay. Co tinh KHONG tich 'title_vi'.
  await fetch(`${api}/api/admin/templates/manage/${tpl.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + admin },
    body: JSON.stringify({
      status: 'published', visibility: 'public',
      editable_fields: ['thank_you_message'],
    }),
  })

  // Cap luot tao thiep cho tai khoan thu.
  const me = await (await fetch(api + '/api/users/profile', { headers: { Authorization: 'Bearer ' + tokenUser } })).json()
  const uid = me?.data?.id
  if (uid) {
    await fetch(`${api}/api/admin/users/${uid}/slots`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + admin },
      body: JSON.stringify({ slots: 5, amount: 5, quantity: 5 }),
    })
  }

  const d = await fetch(api + '/api/invitations/draft', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenUser },
    body: JSON.stringify({ template_id: tpl.id }),
  })
  const dj = await d.json()
  return { admin, tokenUser, tplId: tpl.id, editable: tpl.editable_fields, inv: dj?.data, loiDraft: dj?.message }
}, API, CODE)
check('Dung duoc du lieu thu', Boolean(setup?.inv?.id), JSON.stringify(setup?.loi || setup?.loiDraft || '').slice(0, 120))

const CHO_SUA = 'thank_you_message'   // admin CO tich
const CAM_SUA = 'title_vi'            // admin KHONG tich

const thu = await page.evaluate(async (api, tk, id, cho, cam) => {
  const patch = async (body) => {
    const r = await fetch(`${api}/api/invitations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify(body),
    })
    return { status: r.status, body: await r.json() }
  }
  const doc = async () => (await (await fetch(`${api}/api/invitations/${id}`, { headers: { Authorization: 'Bearer ' + tk } })).json())?.data

  const truoc = await doc()
  const r1 = await patch({ [cho]: 'DUOC-SUA-OK' })
  const r2 = await patch({ [cam]: 'KHONG-DUOC-SUA' })
  const sau = await doc()
  return { truoc: { [cho]: truoc?.[cho], [cam]: truoc?.[cam] }, r1, r2, sau: { [cho]: sau?.[cho], [cam]: sau?.[cam] } }
}, API, setup.tokenUser, setup.inv.id, CHO_SUA, CAM_SUA)

check(`O DUOC tich (${CHO_SUA}) sua duoc`, thu.sau[CHO_SUA] === 'DUOC-SUA-OK', JSON.stringify(thu.sau[CHO_SUA]))
check(`O KHONG tich (${CAM_SUA}) BE chan`, thu.sau[CAM_SUA] !== 'KHONG-DUOC-SUA',
  'gia tri sau khi thu sua: ' + JSON.stringify(thu.sau[CAM_SUA]))
check('BE bao ro o nao bi chan', Array.isArray(thu.r2.body?.data?.blocked_fields)
  && thu.r2.body.data.blocked_fields.includes(CAM_SUA), JSON.stringify(thu.r2.body?.data?.blocked_fields))
check('Chan nhung khong bao loi 500', thu.r2.status < 500, 'HTTP ' + thu.r2.status)

// Thu duong editor-save (trinh sua dung duong nay) — cung phai chan.
const thu2 = await page.evaluate(async (api, tk, id, cam) => {
  const r = await fetch(`${api}/api/invitations/${id}/editor-save`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ invitation: { [cam]: 'LACH-QUA-EDITOR-SAVE' } }),
  })
  const body = await r.json()
  const sau = (await (await fetch(`${api}/api/invitations/${id}`, { headers: { Authorization: 'Bearer ' + tk } })).json())?.data
  return { status: r.status, blocked: body?.data?.blocked_fields, giaTri: sau?.[cam] }
}, API, setup.tokenUser, setup.inv.id, CAM_SUA)
check('Duong editor-save cung chan', thu2.giaTri !== 'LACH-QUA-EDITOR-SAVE', JSON.stringify(thu2.giaTri))
check('editor-save bao ro o bi chan', (thu2.blocked || []).includes(CAM_SUA), JSON.stringify(thu2.blocked))

// Thu nhet vao extra_data — duong vong hay bi bo quen.
const thu3 = await page.evaluate(async (api, tk, id, cam) => {
  const r = await fetch(`${api}/api/invitations/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ extra_data: { [cam]: 'LACH-QUA-EXTRA-DATA' } }),
  })
  const body = await r.json()
  const sau = (await (await fetch(`${api}/api/invitations/${id}`, { headers: { Authorization: 'Bearer ' + tk } })).json())?.data
  return { status: r.status, blocked: body?.data?.blocked_fields, extra: sau?.extra_data?.[cam] }
}, API, setup.tokenUser, setup.inv.id, CAM_SUA)
check('Nhet qua extra_data cung chan', thu3.extra !== 'LACH-QUA-EXTRA-DATA', JSON.stringify(thu3.extra))

// O ngan hang luon cam sua tai cho du admin co tich hay khong.
const thu4 = await page.evaluate(async (api, tk, id) => {
  const r = await fetch(`${api}/api/invitations/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ extra_data: { 'groom.bank_account_number': '0000000000' } }),
  })
  const body = await r.json()
  const sau = (await (await fetch(`${api}/api/invitations/${id}`, { headers: { Authorization: 'Bearer ' + tk } })).json())?.data
  return { blocked: body?.data?.blocked_fields, v: sau?.extra_data?.['groom.bank_account_number'] }
}, API, setup.tokenUser, setup.inv.id)
check('So tai khoan ngan hang khong sua tai cho duoc', thu4.v !== '0000000000', JSON.stringify(thu4.v))

check('Khong co loi JS', errors.filter((e) => !/favicon|404/i.test(e)).length === 0, errors.slice(0, 2).join(' | '))
console.log(`\n=== ${res.filter(Boolean).length}/${res.length} DAT ===`)
await browser.close()
process.exitCode = res.every(Boolean) ? 0 : 1
