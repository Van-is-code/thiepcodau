(function () {
  function readContext() {
    const params = new URLSearchParams(window.location.search);

    const context = {
      guestId: params.get('gid') || localStorage.getItem('guest_id') || '',
      guestName: params.get('gname') || localStorage.getItem('guest_name') || '',
      invitationSlug: params.get('inv') || localStorage.getItem('invitation_slug') || '',
    };

    if (context.guestId) localStorage.setItem('guest_id', context.guestId);
    if (context.guestName) localStorage.setItem('guest_name', context.guestName);
    if (context.invitationSlug) localStorage.setItem('invitation_slug', context.invitationSlug);

    return context;
  }

  async function hydrateGuestName(context) {
    if (context.guestName || !context.guestId) return context;

    try {
      const response = await fetch(`/api/guests/${context.guestId}`);
      if (!response.ok) return context;

      const guest = await response.json();
      if (guest && guest.name) {
        context.guestName = guest.name;
        localStorage.setItem('guest_name', context.guestName);
      }
    } catch (_) {
      // Ignore hydrate failure for public invitation flow
    }

    return context;
  }

  function renderGuestOnPage(context) {
    const inviteHeadline = document.querySelector('#HEADLINE43 .ladi-headline');
    if (inviteHeadline && context.guestName) {
      inviteHeadline.innerHTML = `Trân trọng kính mời <strong>${context.guestName}</strong><br>tham dự bữa tiệc chung vui cùng gia đình chúng tôi<br>`;
    }

    const nameFormItem = document.getElementById('FORM_ITEM2');
    const nameInput = document.querySelector('input[name="name"]');

    if (context.guestId && context.guestName) {
      // Nếu có guest_id: tự động điền tên và ẩn dòng nhập
      if (nameInput) {
        nameInput.value = context.guestName;
        nameInput.readOnly = true;
      }
      if (nameFormItem) {
        nameFormItem.style.display = 'none';
      }
    } else {
      // Nếu không có guest_id: hiển thị dòng nhập tên
      if (nameFormItem) {
        nameFormItem.style.display = 'block';
      }
      if (nameInput) {
        nameInput.placeholder = 'Tên của bạn';
        nameInput.value = '';
        nameInput.readOnly = false;
      }
    }
  }

  function injectGuestIdField(context) {
    // không cần inject, submit sẽ sử dụng context.guestId trực tiếp
  }

  function ensureThankYouPopup() {
    if (document.getElementById('tyOverlay')) return;

    if (!document.getElementById('tyPopupFonts')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'tyPopupFonts';
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Great+Vibes&family=Montserrat:wght@300;400&family=Cinzel:wght@300;400&display=swap';
      document.head.appendChild(fontLink);
    }

    const style = document.createElement('style');
    style.id = 'tyPopupStyles';
    style.textContent = `
      #tyOverlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9999;
        align-items: flex-end;
        justify-content: center;
        background: rgba(15, 8, 2, .6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 0;
      }
      #tyOverlay.active { display: flex; animation: tyFadeOverlay .35s ease; }
      @keyframes tyFadeOverlay { from { opacity: 0; } to { opacity: 1; } }

      .ty-sheet {
        width: 100%;
        max-width: 430px;
        background: #fffdf8;
        border-radius: 28px 28px 0 0;
        overflow: hidden;
        animation: tySlideUp .45s cubic-bezier(.32, 1.2, .64, 1) forwards;
        transform: translateY(100%);
        box-shadow: 0 -12px 60px rgba(0, 0, 0, .22);
      }
      @keyframes tySlideUp { to { transform: translateY(0); } }

      .ty-handle {
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: #d4b896;
        margin: 12px auto 0;
      }

      .ty-photo {
        position: relative;
        height: 200px;
        margin: 16px 16px 0;
        border-radius: 20px;
        overflow: hidden;
      }
      .ty-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 20%;
        filter: brightness(.9) saturate(1.1);
        animation: tyKbPhoto 10s ease-in-out infinite alternate;
      }
      @keyframes tyKbPhoto { from { transform: scale(1); } to { transform: scale(1.07); } }
      .ty-photo::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom, transparent 40%, rgba(255, 253, 248, .9) 100%);
      }

      .ty-photo-name {
        position: absolute;
        bottom: 12px;
        left: 0;
        right: 0;
        z-index: 2;
        text-align: center;
        font-family: 'Great Vibes', cursive;
        font-size: 1.9rem;
        color: #4a2800;
        letter-spacing: 1px;
        text-shadow: 0 1px 8px rgba(255, 255, 255, .5);
      }

      .hearts { display: none; }
      @keyframes tyFloatUp {
        0% { transform: translateY(0) scale(.8); opacity: 0; }
        15% { opacity: .9; }
        85% { opacity: .5; }
        100% { transform: translateY(-215px) scale(1.2); opacity: 0; }
      }

      .ty-body { padding: 18px 24px 32px; text-align: center; }

      .ty-orn {
        display: flex;
        align-items: center;
        gap: 0;
        justify-content: center;
        margin-bottom: 12px;
      }
      .ty-orn-line {
        flex: 1;
        max-width: 80px;
        height: 1px;
        background: linear-gradient(to right, transparent, #c9a96e);
      }
      .ty-orn-line.r { background: linear-gradient(to left, transparent, #c9a96e); }

      .ty-label {
        font-size: 10px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: #c9a96e;
        margin-bottom: 6px;
      }

      .ty-title {
        font-family: 'Great Vibes', cursive;
        font-size: 2.4rem;
        color: #3d2005;
        line-height: 1.1;
        margin-bottom: 12px;
      }

      .ty-text {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.05rem;
        line-height: 1.8;
        color: #6b5240;
        font-style: italic;
        font-weight: 300;
        margin-bottom: 8px;
      }

      .ty-sub {
        font-size: 11.5px;
        color: #b09070;
        line-height: 1.6;
        margin-bottom: 20px;
      }

      .ty-date {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        margin-bottom: 22px;
      }
      .ty-date-block {
        text-align: center;
      }
      .ty-date-label {
        font-family: 'Cinzel', serif;
        font-size: 6.5px;
        font-weight: 300;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        color: #c9a96e;
        display: block;
        margin-bottom: 3px;
      }
      .ty-date-num {
        font-family: 'Cinzel', serif;
        font-size: 1rem;
        font-weight: 300;
        color: #3d2005;
        line-height: 1;
        letter-spacing: 1px;
      }
      .ty-date-sep {
        width: 1px;
        height: 24px;
        background: linear-gradient(to bottom, transparent, #c9a96e, transparent);
        margin: 0 14px;
        flex-shrink: 0;
      }

      .ty-btn {
        width: 100%;
        padding: 15px;
        background: linear-gradient(135deg, #c9a96e 0%, #a67c52 100%);
        color: #fff;
        border: none;
        border-radius: 50px;
        font-family: 'Montserrat', sans-serif;
        font-size: 12px;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 6px 22px rgba(166, 124, 82, .4);
        transition: transform .2s, box-shadow .2s;
        position: relative;
        overflow: hidden;
      }
      .ty-btn:active { transform: scale(.97); }
      .ty-btn::after {
        content: '';
        position: absolute;
        top: 0;
        left: -60%;
        width: 40%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .35), transparent);
        animation: tyShimmer 2.2s infinite;
      }
      @keyframes tyShimmer { to { left: 130%; } }

      #tyConfetti {
        position: fixed;
        inset: 0;
        z-index: 9998;
        pointer-events: none;
      }

      .ty-x {
        position: absolute;
        top: 14px;
        right: 16px;
        z-index: 10;
        background: rgba(255, 255, 255, .8);
        border: none;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b5240;
        backdrop-filter: blur(4px);
      }

      .ty-safe { height: env(safe-area-inset-bottom, 0); }

      @media (min-width: 480px) {
        #tyOverlay {
          align-items: center;
          padding: 20px;
        }
        .ty-sheet {
          border-radius: 24px;
          animation: tyPopIn .45s cubic-bezier(.34, 1.4, .64, 1) forwards;
          transform: scale(.88) translateY(20px);
          opacity: 0;
          box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
        }
      }
      @keyframes tyPopIn { to { transform: scale(1) translateY(0); opacity: 1; } }
    `;

    const confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'tyConfetti';

    const overlay = document.createElement('div');
    overlay.id = 'tyOverlay';
    overlay.innerHTML = `
      <div class="ty-sheet">
        <div class="ty-handle"></div>
        <button class="ty-x" id="tyCloseX">✕</button>
        <div class="ty-photo">
          <img
            src="https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80"
            alt="Ảnh cưới"
            id="tyPhoto"
          />
          <div class="hearts">
            <span class="heart"></span>
            <span class="heart"></span>
            <span class="heart"></span>
            <span class="heart"></span>
          </div>
          <div class="ty-photo-name">Đức Cương &amp; Nguyễn Quyết</div>
        </div>

        <div class="ty-body">
          <div class="ty-orn">
            <div class="ty-orn-line"></div>
            <div class="ty-orn-line r"></div>
          </div>

          <p class="ty-label">Trân trọng cảm ơn</p>
          <h2 class="ty-title">Cảm ơn bạn!</h2>

          <p class="ty-text">
            Lời chúc của bạn là điều ý nghĩa nhất<br>
            trong ngày hạnh phúc của chúng tôi
          </p>

          <p class="ty-sub">
            Chúng tôi đã nhận được lời nhắn của bạn<br>
            Rất mong được đón tiếp bạn trong ngày trọng đại!
          </p>

          <div class="ty-date">
            <div class="ty-date-block">
              <span class="ty-date-label">Ngày</span>
              <span class="ty-date-num">20</span>
            </div>
            <div class="ty-date-sep"></div>
            <div class="ty-date-block">
              <span class="ty-date-label">Tháng</span>
              <span class="ty-date-num">06</span>
            </div>
            <div class="ty-date-sep"></div>
            <div class="ty-date-block">
              <span class="ty-date-label">Năm</span>
              <span class="ty-date-num">2026</span>
            </div>
          </div>
          

          <button class="ty-btn" id="tyCloseBtn">Đóng lại</button>
        </div>

        <div class="ty-safe"></div>
      </div>
    `;

    document.head.appendChild(style);
    document.body.appendChild(confettiCanvas);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeTY();
    });
    overlay.querySelector('#tyCloseX').addEventListener('click', closeTY);
    overlay.querySelector('#tyCloseBtn').addEventListener('click', closeTY);
  }

  const TY_COLORS = ['#c9a96e', '#f0d9b0', '#f5c6cb', '#fff', '#e8c990', '#d4b896'];
  let tyRunning = false;
  let tyRaf;

  function launchConfetti() {
    const canvas = document.getElementById('tyConfetti');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    tyRunning = true;

    const pieces = Array.from({ length: 90 }, function () {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 3,
        h: Math.random() * 4 + 2,
        color: TY_COLORS[Math.floor(Math.random() * TY_COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - .5) * .14,
        vx: (Math.random() - .5) * 1.8,
        vy: Math.random() * 2.8 + 1.4,
        alpha: Math.random() * .5 + .45,
      };
    });

    (function draw() {
      if (!tyRunning) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(function (piece) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rot += piece.spin;
        if (piece.y > canvas.height) {
          piece.y = -10;
          piece.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.globalAlpha = piece.alpha;
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      });

      tyRaf = requestAnimationFrame(draw);
    })();

    setTimeout(stopConfetti, 4500);
  }

  function stopConfetti() {
    tyRunning = false;
    cancelAnimationFrame(tyRaf);

    const canvas = document.getElementById('tyConfetti');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function showTY() {
    ensureThankYouPopup();
    const overlay = document.getElementById('tyOverlay');
    if (!overlay) return;

    overlay.classList.add('active');
    overlay.style.opacity = '1';
    launchConfetti();
  }

  function closeTY() {
    const overlay = document.getElementById('tyOverlay');
    if (!overlay) return;

    const sheet = overlay.querySelector('.ty-sheet');
    sheet.style.transition = 'transform .3s ease, opacity .3s ease';
    sheet.style.transform = 'translateY(100%)';
    sheet.style.opacity = '0';

    overlay.style.transition = 'opacity .35s ease';
    overlay.style.opacity = '0';

    setTimeout(function () {
      overlay.classList.remove('active');
      overlay.style.cssText = '';
      sheet.style.cssText = '';
      stopConfetti();
    }, 350);
  }

  function wireCheckinSubmit(context) {
    const form = document.querySelector('#FORM2 form');
    if (!form) {
      return;
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const messageInput = form.querySelector('textarea[name="message"]');
      const attendanceInput = form.querySelector('input[name="form_item6"]:checked');
      const nameInput = form.querySelector('input[name="name"]');

      // Lấy tên từ input field (đã được tự động điền sẵn nếu có guest_id)
      // Fallback về context.guestName nếu input không có giá trị
      let guestName = nameInput ? nameInput.value.trim() : '';
      if (!guestName && context.guestName) {
        guestName = context.guestName;
      }

      const payload = {
        guest_id: context.guestId || null,
        invitation_slug: context.invitationSlug || null,
        name_guest: guestName,
        messages: messageInput ? messageInput.value.trim() : null,
        confirm_attendance: attendanceInput ? attendanceInput.value : null,
        number_of_attendees: null,
        guests_type: context.guestId ? 'private' : 'public',
      };

      if (!payload.name_guest) {
        alert('Vui lòng nhập tên của bạn.');
        return;
      }

      try {
        const response = await fetch('/api/messages-checkins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(function () {
            return { message: 'Không gửi được lời nhắn.' };
          });
          throw new Error(errorBody.message || 'Không gửi được lời nhắn.');
        }

        await response.json();

        showTY();
        form.reset();
        renderGuestOnPage(context);
      } catch (error) {
        alert(error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    ensureThankYouPopup();
    const context = readContext();
    await hydrateGuestName(context);
    renderGuestOnPage(context);
    wireCheckinSubmit(context);
  });
})();
