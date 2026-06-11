// ======= STYLE =======
const style = document.createElement("style");
style.innerHTML = `
.fnav {
  position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  font-family: 'Jost', sans-serif;
}
.fnav.hidden { display: none; }

/* Links */
.fnav-links {
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  opacity: 0; pointer-events: none;
  transform: translateY(8px);
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.fnav-links.open { opacity: 1; pointer-events: auto; transform: translateY(0); }

.fnav-link {
  padding: 7px 16px 7px 12px;
  background: rgba(50,35,22,0.9);
  backdrop-filter: blur(8px);
  color: #e8d5a3;
  border-radius: 999px;
  text-decoration: none;
  font-size: 10px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase;
  border: 1px solid rgba(201,169,110,0.2);
  display: flex; align-items: center; gap: 8px;
  white-space: nowrap;
  box-shadow: 0 3px 12px rgba(0,0,0,0.18);
  transition: background 0.15s, transform 0.15s, border-color 0.15s;
}
.fnav-link:hover { background: rgba(92,64,51,0.95); border-color: rgba(201,169,110,0.45); transform: translateX(-3px); }
.fnav-link.active { background: rgba(154,122,69,0.55); border-color: rgba(201,169,110,0.4); }

.fnav-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: #c9a96e; flex-shrink: 0;
}
.fnav-link.active .fnav-dot { background: #e8d5a3; }

/* Bottom row: dismiss + toggle */
.fnav-row { display: flex; align-items: center; gap: 7px; }

/* Dismiss */
.fnav-close {
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(50,35,22,0.5);
  border: 1px solid rgba(201,169,110,0.15);
  color: rgba(255,255,255,0.25);
  font-size: 9px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; backdrop-filter: blur(4px);
  font-family: 'Jost', sans-serif; line-height: 1;
}
.fnav-close:hover { background: rgba(176,80,80,0.55); color: rgba(255,255,255,0.7); border-color: rgba(176,80,80,0.3); }

/* Diamond toggle */
.fnav-toggle {
  width: 44px; height: 44px;
  border: none; cursor: pointer;
  background: linear-gradient(135deg, #9a7a45, #c9a96e);
  border-radius: 4px;
  transform: rotate(45deg);
  box-shadow: 0 4px 18px rgba(154,122,69,0.42);
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow 0.2s;
  position: relative;
}
.fnav-toggle:hover { box-shadow: 0 6px 24px rgba(154,122,69,0.58); }

.fnav-toggle-inner {
  transform: rotate(-45deg);
  display: flex; align-items: center; justify-content: center;
  position: relative; width: 100%; height: 100%;
}
.fnav-bars, .fnav-x {
  position: absolute;
  transition: opacity 0.2s, transform 0.2s;
}
.fnav-bars { display: flex; flex-direction: column; gap: 3.5px; align-items: center; }
.fnav-bars span { display: block; width: 14px; height: 1.5px; background: rgba(255,255,255,0.9); border-radius: 2px; }
.fnav-x { font-size: 14px; color: rgba(255,255,255,0.9); opacity: 0; transform: rotate(-90deg) scale(0.6); }
.fnav-toggle.open .fnav-bars { opacity: 0; transform: scale(0.4); }
.fnav-toggle.open .fnav-x   { opacity: 1; transform: rotate(0deg) scale(1); }
`;
document.head.appendChild(style);

// ======= HTML =======
const wrap = document.createElement("div");
wrap.className = "fnav";
wrap.id = "fnav";
wrap.innerHTML = `
  <div class="fnav-links" id="fnavLinks">
    <a class="fnav-link" href="/" id="fnav-home"><span class="fnav-dot"></span>Trang chủ</a>
    <a class="fnav-link" href="/moi-cuoi" id="fnav-invite"><span class="fnav-dot"></span>Mời cưới</a>
    <a class="fnav-link" href="/danh-sach" id="fnav-guests"><span class="fnav-dot"></span>Danh sách khách</a>
    <a class="fnav-link" href="/xac-nhan" id="fnav-rsvp"><span class="fnav-dot"></span>Xác nhận tham dự</a>
  </div>
  <div class="fnav-row">
    <button class="fnav-close" id="fnavClose" title="Ẩn">✕</button>
    <button class="fnav-toggle" id="fnavToggle" aria-label="Menu">
      <div class="fnav-toggle-inner">
        <div class="fnav-bars"><span></span><span></span><span></span></div>
        <div class="fnav-x">✕</div>
      </div>
    </button>
  </div>
`;
document.body.appendChild(wrap);

// ======= Script =======
(function() {
  const toggle = document.getElementById('fnavToggle');
  const links = document.getElementById('fnavLinks');
  const close = document.getElementById('fnavClose');

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const map = {
    '/': 'fnav-home',
    '/moi-cuoi': 'fnav-invite',
    '/danh-sach': 'fnav-guests',
    '/xac-nhan': 'fnav-rsvp',
  };
  const activeId = map[path];
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
  }

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    links.classList.toggle('open');
  });
  close.addEventListener('click', () => wrap.classList.add('hidden'));
  links.querySelectorAll('.fnav-link').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.classList.remove('open');
  }));
})();
