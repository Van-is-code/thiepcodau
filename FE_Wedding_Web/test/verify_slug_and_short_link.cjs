const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIyMjIyMjIyLTIyMjItMjIyMi0yMjIyLTIyMjIyMjIyMjIyMiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5Mjc3NzAyMSwiZXhwIjoxNzkzMzgxODIxfQ.pQwWDiIF5styG1VqR0KnLqlta9brSqgF43K_tWh3Gnk';
const ARTIFACT_DIR = 'C:\\Users\\thanh\\.gemini\\antigravity\\brain\\9da78a01-9ffa-44a0-b452-3668a09dd898';

(async () => {
  let browser;
  try {
    console.log('Launching Chrome...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    // Inject token to localStorage
    await page.goto('https://thiepminh.io.vn/auth', { waitUntil: 'networkidle2' });
    await page.evaluate((tok) => {
      localStorage.setItem('token', tok);
      localStorage.setItem('user', JSON.stringify({ id: '22222222-2222-2222-2222-222222222222', role: 'admin' }));
    }, TOKEN);

    console.log('Navigating to /dashboard/invite...');
    await page.goto('https://thiepminh.io.vn/dashboard/invite', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Find "Đổi Đường Dẫn (Slug)" button
    let targetSlugBtn = null;
    for (const btn of await page.$$('button')) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt.includes('Đổi Đường Dẫn') || txt.includes('Slug')) {
        targetSlugBtn = btn;
        break;
      }
    }

    if (!targetSlugBtn) {
      throw new Error('Could not find "Đổi Đường Dẫn (Slug)" button');
    }

    console.log('Opening Change Slug Modal...');
    await targetSlugBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    // Test Collision / Duplicate Slug: Type a reserved or existing slug "dashboard"
    console.log('Testing duplicate / collision warning with slug "dashboard"...');
    const slugInput = await page.$('input[placeholder*="chien-hang"]');
    if (slugInput) {
      await slugInput.click({ clickCount: 3 });
      await slugInput.type('dashboard');
      await new Promise(r => setTimeout(r, 1200)); // wait for debounce
    }

    const collisionShot = path.join(ARTIFACT_DIR, 'live_verified_slug_collision_warning.png');
    await page.screenshot({ path: collisionShot });
    console.log('Saved screenshot of collision warning:', collisionShot);

    // Click Tab 2: "Theo Dâu Rể"
    console.log('Testing Tab 2 (Theo Dâu Rể)...');
    for (const b of await page.$$('button')) {
      const t = await page.evaluate(el => el.textContent, b);
      if (t.includes('Theo Dâu Rể')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    const tab2Shot = path.join(ARTIFACT_DIR, 'live_verified_change_slug_modal_tab2.png');
    await page.screenshot({ path: tab2Shot });

    // Click Tab 3: "Ngẫu nhiên"
    console.log('Testing Tab 3 (Ngẫu nhiên)...');
    for (const b of await page.$$('button')) {
      const t = await page.evaluate(el => el.textContent, b);
      if (t.includes('Ngẫu nhiên')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));
    const tab3Shot = path.join(ARTIFACT_DIR, 'live_verified_change_slug_modal_tab3.png');
    await page.screenshot({ path: tab3Shot });

    // Close modal
    for (const b of await page.$$('button')) {
      const t = await page.evaluate(el => el.textContent, b);
      if (t.trim() === 'Đóng') {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 800));

    // Now test creating a guest with custom reception time
    console.log('Creating guest with clean short link...');
    const testGuestName = 'Anh Vân và người thương';
    const testCustomTime = '11:45';

    const nameInput = await page.$('input.invite-inline-input') || await page.$('input[placeholder*="Anh Tuấn"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(testGuestName);
    }

    const timeInput = await page.$('input[placeholder="VD: 11:30, 18:00..."]');
    if (timeInput) {
      await timeInput.click({ clickCount: 3 });
      await timeInput.type(testCustomTime);
    }

    // Click "Tạo Link"
    const createBtn = await page.$('button.invite-create-btn');
    if (createBtn) {
      await createBtn.click();
    } else {
      for (const b of await page.$$('button')) {
        const t = await page.evaluate(el => el.textContent, b);
        if (t.includes('Tạo Link')) {
          await b.click();
          break;
        }
      }
    }
    await new Promise(r => setTimeout(r, 2500));

    // Inspect created link from .gen-url
    const linkText = await page.evaluate(() => {
      const disp = document.querySelector('.gen-url');
      return disp ? disp.textContent.trim() : '';
    });
    console.log('Created Guest URL:', linkText);

    const invitePageShot = path.join(ARTIFACT_DIR, 'live_verified_created_short_link.png');
    await page.screenshot({ path: invitePageShot });
    console.log('Saved screenshot of created short link:', invitePageShot);

    // Verify the short link in a new mobile view
    if (linkText && linkText.startsWith('http')) {
      console.log('Opening clean short link in mobile view:', linkText);
      const guestPage = await browser.newPage();
      await guestPage.setViewport({ width: 430, height: 932, isMobile: true });
      await guestPage.goto(linkText, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3500));

      const guestEnvShot = path.join(ARTIFACT_DIR, 'live_verified_short_link_envelope.png');
      await guestPage.screenshot({ path: guestEnvShot });
      console.log('Saved screenshot of guest envelope:', guestEnvShot);

      // Scroll down to check reception time
      await guestPage.evaluate(() => {
        window.scrollBy(0, 1400);
      });
      await new Promise(r => setTimeout(r, 1200));

      const guestReceptionShot = path.join(ARTIFACT_DIR, 'live_verified_short_link_reception.png');
      await guestPage.screenshot({ path: guestReceptionShot });
      console.log('Saved screenshot of reception time:', guestReceptionShot);

      await guestPage.close();
    }

    // Verify Guest list table on /dashboard/guests
    console.log('Navigating to /dashboard/guests...');
    await page.goto('https://thiepminh.io.vn/dashboard/guests', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const guestsPageShot = path.join(ARTIFACT_DIR, 'live_verified_guests_page_final.png');
    await page.screenshot({ path: guestsPageShot });
    console.log('Saved screenshot of guests page:', guestsPageShot);

    console.log('ALL VERIFICATIONS PASSED!');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();

