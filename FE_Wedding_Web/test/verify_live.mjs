import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';
import path from 'path';

const CHROME = [
  process.env.CHROME_PATH,
  [process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
  [process.env['LocalAppData'], 'Google', 'Chrome', 'Application', 'chrome.exe'].join('/'),
].filter(Boolean).find((c) => { try { return existsSync(c) } catch { return false } });

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5Mjc3NzAyMSwiZXhwIjoxNzkzMzgxODIxfQ.pQwWDiIF5styG1VqR0KnLqlta9brSqgF43K_tWh3Gnk';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

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

  await browser.close();
})().catch(console.error);
