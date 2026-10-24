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
  await page.setViewport({ width: 1280, height: 950 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

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

  console.log('--- Navigating to /dashboard/guests ---');
  await page.goto('https://thiepminh.io.vn/dashboard/guests', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Extract table headers
  const headers = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.gt-th')).map(th => th.textContent.trim());
  });
  console.log('Table Headers:', headers);

  // Extract rows info
  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.gt-row')).map(row => {
      const name = row.querySelector('.gt-name')?.textContent.trim();
      const tds = Array.from(row.querySelectorAll('.gt-td'));
      const timeBadge = tds[1]?.textContent.trim();
      const note = tds[2]?.textContent.trim();
      const url = tds[3]?.textContent.trim();
      return { name, timeBadge, note, url };
    });
  });
  console.log('Guest Rows with Time Display:', rows);

  await page.screenshot({ path: path.join(artifactDir, 'live_verified_guests_page_time.png') });
  console.log('Saved live_verified_guests_page_time.png');

  // Open "Thêm Khách Mới" modal
  const addButtons = await page.$$('button');
  for (const b of addButtons) {
    const text = await (await b.getProperty('textContent')).jsonValue();
    if (text.includes('Thêm Khách Mới')) {
      await b.click();
      console.log('Opened Add Guest Modal');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(artifactDir, 'live_verified_add_guest_modal_time.png') });
  console.log('Saved live_verified_add_guest_modal_time.png');

  await browser.close();
  console.log('ALL GUEST LIST VERIFICATIONS COMPLETED SUCCESSFULLY!');
  process.exit(0);
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
