const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5Mjc3NzAyMSwiZXhwIjoxNzkzMzgxODIxfQ.pQwWDiIF5styG1VqR0KnLqlta9brSqgF43K_tWh3Gnk';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  await page.goto('https://thiepminh.io.vn/auth', { waitUntil: 'networkidle2' });
  await page.evaluate(t => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify({ id: '22222222-2222-2222-2222-222222222222', role: 'admin' }));
  }, TOKEN);

  await page.goto('https://thiepminh.io.vn/dashboard/invite', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const nameInput = await page.$('input.invite-inline-input');
  await nameInput.click({ clickCount: 3 });
  await nameInput.type('Bác Thành và Gia Đình');

  // Click 17:30 preset
  for (const b of await page.$$('button')) {
    const txt = await page.evaluate(el => el.textContent.trim(), b);
    if (txt === '17:30') {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 500));

  const createBtn = await page.$('button.invite-create-btn');
  await createBtn.click();
  await new Promise(r => setTimeout(r, 2500));

  const linkText = await page.evaluate(() => {
    const el = document.querySelector('.gen-url');
    return el ? el.textContent.trim() : '';
  });
  console.log('Created link with custom time 17:30:', linkText);

  if (linkText.startsWith('http')) {
    const gPage = await browser.newPage();
    await gPage.setViewport({ width: 430, height: 932, isMobile: true });
    await gPage.goto(linkText, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3500));

    const frame = gPage.frames().find(f => f !== gPage.mainFrame());
    const res = await frame.evaluate(() => {
      return {
        name: document.body.innerText.includes('Bác Thành và Gia Đình'),
        has1730: document.body.innerText.includes('17:30')
      };
    });
    console.log('Guest page check result:', res);

    // Scroll to reception
    await frame.evaluate(() => {
      const rec = document.querySelector('.reception-section') || document.querySelector('#tieccuoi') || document.querySelector('.party-section');
      if (rec) rec.scrollIntoView();
      else window.scrollBy(0, 1600);
    });
    await new Promise(r => setTimeout(r, 1200));

    await gPage.screenshot({ path: 'C:\\Users\\thanh\\.gemini\\antigravity\\brain\\9da78a01-9ffa-44a0-b452-3668a09dd898\\live_verified_1730_reception.png' });
    console.log('Saved live_verified_1730_reception.png');
    await gPage.close();
  }

  await browser.close();
})();

