// Mo thiep that (mau vua nhap tu theme) bang Chrome, doi chieu du lieu khach.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const CHROME=[process.env.CHROME_PATH,[process.env['ProgramFiles'],'Google','Chrome','Application','chrome.exe'].join('/')]
  .filter(Boolean).find(c=>{try{return existsSync(c)}catch{return false}})
const FE=process.env.FE_URL||'http://localhost:5173'
const res=[]; const check=(n,ok,d='')=>{res.push(ok);const dd=String(d||'').replace(/\s+/g,' ').slice(0,46);console.log(`${ok?'DAT   ':'TRUOT '} | ${n}${dd?' :: '+dd:''}`)}

const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']})
const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:2})
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())})

const t0=Date.now()
await p.goto(FE+'/'+process.argv[2],{waitUntil:'networkidle2',timeout:40000})
check('Mo duoc thiep cong khai', true, (Date.now()-t0)+'ms')
await new Promise(r=>setTimeout(r,2000))

// Mo phong bi/thu: noi dung chinh nam sau man mo thu nen phai bam vao truoc.
const fr0=p.frames().find(f=>f!==p.mainFrame())||p.mainFrame()
await fr0.evaluate(()=>{
  const sels=['#wax-seal','#envelope-container','.letter-seal','.envelope-stage','.intro-letter','[class*="seal"]','[class*="envelope"]']
  for(const s of sels){const e=document.querySelector(s); if(e){e.click(); return}}
  document.body.click()
}).catch(()=>{})
await new Promise(r=>setTimeout(r,3500))
// Cuon het trang de moi phan duoc dung
await fr0.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80))}}).catch(()=>{})
await new Promise(r=>setTimeout(r,800))

const fr=p.frames().find(f=>f!==p.mainFrame())||p.mainFrame()
// textContent chu KHONG phai innerText: theme dung GSAP nen nhieu phan con o
// trang thai an/chua animate vao — innerText bo qua chung va bao truot oan.
const txt=await fr.evaluate(()=>document.body.textContent.replace(/\s+/g,' '))

check('Ten chu re that', txt.includes('Trần Minh Khôi')||txt.includes('Khôi'), (txt.match(/Trần Minh Khôi|Khôi/)||[])[0])
check('Ten co dau that', txt.includes('Vũ Hà Phương')||txt.includes('Phương'), (txt.match(/Vũ Hà Phương|Phương/)||[])[0])
check('Cha chu re that', txt.includes('Trần Văn Bình'), (txt.match(/Trần Văn Bình/)||[])[0])
check('Me co dau that', txt.includes('Ngô Thị Lan'), (txt.match(/Ngô Thị Lan/)||[])[0])
check('Dia chi le that', txt.includes('Lạch Tray'), (txt.match(/Số 9 Lạch Tray[^\n]*/)||[])[0])
check('Dia chi tiec that', txt.includes('Biển Đông'), (txt.match(/Nhà hàng Biển Đông[^\n]*/)||[])[0])
check('Am lich that', txt.includes('Mậu Thân'), (txt.match(/\(Nhằm[^)]*\)/)||[])[0])
check('Ngay cuoi that (2028)', /2028/.test(txt), (txt.match(/\d{2}\.\d{2}\.2028/)||[])[0])
check('Loi cam on that', txt.includes('Xin chân thành cảm ơn'))

// Khong con du lieu mau cua theme
const demo=['Duy Nam','Vân Anh','Dương Văn Kiên','TRỐNG ĐỒNG PALACE','18.01.2026','Kim Chung'].filter(x=>txt.includes(x))
check('Khong con du lieu mau cua theme', demo.length===0, demo.join(' | ')||'sach')

check('Khong co loi JS', errs.filter(e=>!/favicon|404|Failed to load resource/i.test(e)).length===0, errs.slice(0,2).join(' | '))
await p.screenshot({path:process.env.SHOT||'r.png'})
console.log(`\n=== ${res.filter(Boolean).length}/${res.length} DAT ===`)
await b.close()
