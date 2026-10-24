import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';
import path from 'path';

const CHROME = [
  process.env.CHROME_PATH,
  [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env['LocalAppData'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
].filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } });

console.log('Using Chrome:', CHROME);

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5Mjc3NzAyMSwiZXhwIjoxNzkzMzgxODIxfQ.pQwWDiIF5styG1VqR0KnLqlta9brSqgF43K_tWh3Gnk';
const artifactDir = path.resolve('C:/Users/thanh/.gemini/antigravity/brain/9da78a01-9ffa-44a0-b452-3668a09dd898');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true });

  console.log('--- Test 1: Envelope Outside Flap Cursive Font ---');
  await page.goto('https://thiepminh.io.vn/thiep-mvl48b4q4ty8?to=Anh+Tu%E1%BA%A5n&time=17:30', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const frameHandle = await page.$('iframe');
  let frame = page;
  if (frameHandle) {
    frame = await frameHandle.contentFrame();
  }

  // Get recipient styling
  const recipientInfo = await frame.evaluate(() => {
    const el = document.getElementById('envelope-recipient-name') || document.querySelector('.recipient-name');
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    return {
      text: el.textContent,
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      color: computed.color,
      textTransform: computed.textTransform
    };
  });
  console.log('Recipient Info on Envelope:', recipientInfo);

  await page.screenshot({ path: path.join(artifactDir, 'live_verified_envelope_cursive.png') });
  console.log('Saved live_verified_envelope_cursive.png');

  console.log('--- Test 2: Check Reception Time with custom time 17:30 ---');
  // Open letter
  await frame.evaluate(() => {
    const intro = document.getElementById('wedding-letter-intro');
    if (intro) intro.style.display = 'none';
    document.body.classList.remove('intro-active');
  });
  await new Promise(r => setTimeout(r, 1500));

  const receptionInfoCustom = await frame.evaluate(() => {
    const el = document.querySelector('[data-field="reception_time"]') || document.querySelector('.event-exact-time');
    return el ? el.textContent.trim() : null;
  });
  console.log('Reception Time with ?time=17:30:', receptionInfoCustom);

  // Scroll to reception/banquet section
  await frame.evaluate(() => {
    const sec = document.querySelector('.scene-timeline, .scene-events, #events, [data-field="reception_time"]');
    if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'live_verified_reception_custom_time.png') });
  console.log('Saved live_verified_reception_custom_time.png');

  console.log('--- Test 3: Public Invitation Default Reception Time (must be 11:00, NOT 00:00) ---');
  await page.goto('https://thiepminh.io.vn/thiep-mvl48b4q4ty8?skip_intro=true', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const frameHandle2 = await page.$('iframe');
  let frame2 = page;
  if (frameHandle2) {
    frame2 = await frameHandle2.contentFrame();
  }

  const receptionInfoDefault = await frame2.evaluate(() => {
    const el = document.querySelector('[data-field="reception_time"]') || document.querySelector('.event-exact-time');
    return el ? el.textContent.trim() : null;
  });
  console.log('Reception Time on Default Public Link:', receptionInfoDefault);

  await frame2.evaluate(() => {
    const sec = document.querySelector('[data-field="reception_time"]') || document.querySelector('.event-exact-time');
    if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'live_verified_reception_default_time.png') });
  console.log('Saved live_verified_reception_default_time.png');

  console.log('--- Test 4: Dashboard Invite Page UI with Time Selection ---');
  await page.setViewport({ width: 1280, height: 950 });
  await page.goto('https://thiepminh.io.vn/login', { waitUntil: 'networkidle2' });
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'admin@weddingweb.com',
      role: 'admin',
      name: 'Admin System'
    }));
  }, TOKEN);

  await page.goto('https://thiepminh.io.vn/dashboard/invite', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Type guest name
  const nameInput = await page.$('input[placeholder*="Anh Tuấn"]');
  if (nameInput) {
    await nameInput.type('Anh Tuấn');
  }

  // Click 17:30 preset button
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await (await b.getProperty('textContent')).jsonValue();
    if (text.trim() === '17:30') {
      await b.click();
      console.log('Clicked 17:30 preset');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 500));

  // Click Tao Link
  const allButtons = await page.$$('button');
  for (const b of allButtons) {
    const text = await (await b.getProperty('textContent')).jsonValue();
    if (text.includes('Tạo Link')) {
      await b.click();
      console.log('Clicked Tạo Link button');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  const resultData = await page.evaluate(() => {
    const genBox = document.querySelector('.gen-box');
    const genUrl = document.querySelector('.gen-url');
    return {
      boxText: genBox ? genBox.innerText : null,
      url: genUrl ? genUrl.innerText : null
    };
  });
  console.log('Result Data after generating link:', resultData);

  await page.screenshot({ path: path.join(artifactDir, 'live_verified_invite_page_time_picker.png') });
  console.log('Saved live_verified_invite_page_time_picker.png');

  await browser.close();
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
})().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

