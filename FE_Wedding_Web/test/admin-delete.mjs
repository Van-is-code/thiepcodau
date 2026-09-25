// Kiem nut XOA tren giao dien: chan khi dang co thiep dung, cho xoa khi khong.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const CHROME=[process.env.CHROME_PATH,[process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find(c=>{try{return existsSync(c)}catch{return false}})
const FE=process.env.FE_URL||'http://localhost:5173'
const res=[]; const check=(n,ok,d='')=>{res.push(ok);console.log(`${ok?'DAT   ':'TRUOT '} | ${n}${d?' :: '+String(d).slice(0,60):''}`)}

const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']})
const p=await b.newPage(); await p.setViewport({width:1440,height:900})
const errs=[]; p.on('pageerror',e=>errs.push(e.message))

await p.goto(FE+'/auth',{waitUntil:'domcontentloaded'})
await p.evaluate(async()=>{const r=await fetch('http://localhost:3000/api/users/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})});localStorage.setItem('token',(await r.json())?.data?.token||'')})
await p.goto(FE+'/admin',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,1000))
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>/Quản Lý Mẫu/i.test(x.textContent))?.click())
await new Promise(r=>setTimeout(r,1500))

const t0=await p.evaluate(()=>document.body.innerText)
check('Thay mau da nhap', /hydrangea-editorial/i.test(t0))
check('Hien so thiep dang dung', /\d+ thiệp đang dùng/.test(t0), t0.match(/\d+ thiệp đang dùng/)?.[0])

// --- Ca 1: dang co thiep dung -> phai bi chan kem giai thich ---
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Xoá')?.click())
await new Promise(r=>setTimeout(r,900))
const warn=await p.evaluate(()=>document.body.innerText)
check('Chan xoa khi dang co thiep dung', /Không thể xoá mẫu này/i.test(warn))
check('Giai thich ro hau qua', /mất giao diện|trang lỗi/i.test(warn))
check('Goi y TAT thay vi xoa', /TẮT mẫu thay vì xoá/i.test(warn))
await p.screenshot({path:process.env.SHOT1||'del-blocked.png'})
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>/Đã hiểu|OK|Đóng/i.test(x.textContent))?.click())
await new Promise(r=>setTimeout(r,700))

// --- Ca 2: xoa het thiep roi xoa mau ---
await p.evaluate(async()=>{
  const tok=localStorage.getItem('token')
  const r=await fetch('http://localhost:3000/api/admin/invitations',{headers:{Authorization:'Bearer '+tok}})
  const items=(await r.json())?.data?.items||[]
  for(const i of items) await fetch('http://localhost:3000/api/admin/invitations/'+i.id,{method:'DELETE',headers:{Authorization:'Bearer '+tok}})
})
await p.reload({waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,900))
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>/Quản Lý Mẫu/i.test(x.textContent))?.click())
await new Promise(r=>setTimeout(r,1400))
check('Sau khi xoa thiep: hien 0 thiep dang dung', /0 thiệp đang dùng/.test(await p.evaluate(()=>document.body.innerText)))

await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Xoá')?.click())
await new Promise(r=>setTimeout(r,800))
const conf=await p.evaluate(()=>document.body.innerText)
check('Hien hop xac nhan xoa', /Xoá mẫu thiệp|Không khôi phục/i.test(conf))
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Xoá mẫu')?.click())
await new Promise(r=>setTimeout(r,2500))
const after=await p.evaluate(()=>document.body.innerText)
check('Da xoa: mau bien mat khoi danh sach', !/hydrangea-editorial/i.test(after))
await p.screenshot({path:process.env.SHOT2||'del-done.png'})

check('Khong co loi JS', errs.filter(e=>!/favicon|404/i.test(e)).length===0, errs.slice(0,2).join(' | '))
console.log(`\n=== ${res.filter(Boolean).length}/${res.length} DAT ===`)
await b.close()
