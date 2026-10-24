const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5Mjc3NzAyMSwiZXhwIjoxNzkzMzgxODIxfQ.pQwWDiIF5styG1VqR0KnLqlta9brSqgF43K_tWh3Gnk';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  await page.goto('https://thiepminh.io.vn/login', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    localStorage.setItem('wedding_access_token', tok);
    localStorage.setItem('auth_token', tok);
  }, TOKEN);

  await page.goto('https://thiepminh.io.vn/dashboard/invite', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const url = page.url();
  console.log('Current URL:', url);

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
  });
  console.log('All buttons on page:', buttons);

  await page.screenshot({ path: 'C:\\Users\\thanh\\.gemini\\antigravity\\brain\\9da78a01-9ffa-44a0-b452-3668a09dd898\\debug_invite_buttons.png' });

  await browser.close();
})();

