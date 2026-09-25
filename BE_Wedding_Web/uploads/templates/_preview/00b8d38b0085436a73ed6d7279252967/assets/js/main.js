/**
 * Lavender Hydrangea Wedding Editorial — Main Script
 * Controls: Countdown, 1-Click Copy STK, Lookbook Lightbox, Guestbook Journal, RSVP, Music Player
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initCountdown();
    initCopySTK();
    initLightbox();
    initGiftModal();
    initUnifiedBlessing();
    initMusic();
    initScrollObserver();
  });

  /* ------------------------------------------------------------------ */
  /* Toast Pill Notification Helper                                     */
  /* ------------------------------------------------------------------ */
  function showToast(message) {
    var toast = document.getElementById('toast-pill');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  /* ------------------------------------------------------------------ */
  /* 1. Real-Time Wedding Countdown                                      */
  /* ------------------------------------------------------------------ */
  function initCountdown() {
    var el = document.querySelector('[data-countdown]');
    if (!el) return;
    var targetAttr = el.getAttribute('data-countdown');
    var targetDate = new Date(targetAttr).getTime();
    var daysSpan = el.querySelector('[data-unit="days"]');
    var hoursSpan = el.querySelector('[data-unit="hours"]');
    var minutesSpan = el.querySelector('[data-unit="minutes"]');
    var secondsSpan = el.querySelector('[data-unit="seconds"]');

    // If target date in the past, provide active demo countdown (48 days ahead) so seconds tick vividly
    var now = Date.now();
    if (isNaN(targetDate) || targetDate <= now) {
      targetDate = now + (48 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000) + (29 * 60 * 1000) + (50 * 1000);
    }

    function updateTimer() {
      var current = Date.now();
      var diff = targetDate - current;
      if (diff < 0) diff = 0;

      var days = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (daysSpan) daysSpan.textContent = String(days).padStart(2, '0');
      if (hoursSpan) hoursSpan.textContent = String(hours).padStart(2, '0');
      if (minutesSpan) minutesSpan.textContent = String(minutes).padStart(2, '0');
      if (secondsSpan) secondsSpan.textContent = String(seconds).padStart(2, '0');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* 2. 1-Click Copy Bank Account Number                                 */
  /* ------------------------------------------------------------------ */
  function initCopySTK() {
    var copyBtns = document.querySelectorAll('[data-copy-account]');
    copyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var acc = btn.getAttribute('data-copy-account');
        if (!acc) return;

        function fallbackCopy(text) {
          var textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
          } catch (err) {}
          document.body.removeChild(textArea);
          showToast('✓ Đã sao chép STK: ' + text);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(acc).then(function () {
            showToast('✓ Đã sao chép STK: ' + acc);
          }).catch(function () {
            fallbackCopy(acc);
          });
        } else {
          fallbackCopy(acc);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Lookbook Editorial Photo Lightbox                               */
  /* ------------------------------------------------------------------ */
  function initLightbox() {
    var items = document.querySelectorAll('.gallery-item img');
    if (!items.length) return;

    var images = [];
    items.forEach(function (img, index) {
      images.push({ src: img.src, alt: img.alt });
      img.parentElement.addEventListener('click', function () {
        openLightbox(index);
      });
    });

    var activeIdx = 0;
    var modal = document.getElementById('lightbox-modal');
    var modalImg = document.getElementById('lightbox-img');
    var counter = document.getElementById('lightbox-counter');
    var closeBtn = document.getElementById('lightbox-close');
    var prevBtn = document.getElementById('lightbox-prev');
    var nextBtn = document.getElementById('lightbox-next');

    function renderImage() {
      if (!modalImg || !counter) return;
      modalImg.src = images[activeIdx].src;
      modalImg.alt = images[activeIdx].alt || '';
      counter.textContent = (activeIdx + 1) + ' / ' + images.length;
    }

    function openLightbox(idx) {
      activeIdx = idx;
      renderImage();
      if (modal) {
        modal.classList.add('is-active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeLightbox() {
      if (modal) {
        modal.classList.remove('is-active');
        document.body.style.overflow = '';
      }
    }

    function prev() {
      activeIdx = (activeIdx - 1 + images.length) % images.length;
      renderImage();
    }

    function next() {
      activeIdx = (activeIdx + 1) % images.length;
      renderImage();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); next(); });

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeLightbox();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!modal || !modal.classList.contains('is-active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // Touch swipe support for mobile
    var touchX = 0;
    if (modal) {
      modal.addEventListener('touchstart', function (e) {
        touchX = e.changedTouches[0].screenX;
      }, { passive: true });
      modal.addEventListener('touchend', function (e) {
        var diff = e.changedTouches[0].screenX - touchX;
        if (diff > 45) prev();
        if (diff < -45) next();
      }, { passive: true });
    }
  }

  /* ------------------------------------------------------------------ */
  /* 4. Stationery Gift Popup Modal                                     */
  /* ------------------------------------------------------------------ */
  function initGiftModal() {
    var modal = document.getElementById('gift-modal');
    var openBtns = document.querySelectorAll('[data-open-gift-modal]');
    var closeBtn = document.getElementById('gift-modal-close');
    var qrImg = document.getElementById('single-gift-qr');
    var bankName = document.getElementById('gift-modal-bank');
    var accNum = document.getElementById('gift-modal-acc-num');
    var accName = document.getElementById('gift-modal-acc-name');
    var copyBtn = document.getElementById('gift-modal-copy-btn');
    var tabs = document.querySelectorAll('.recipient-tab');

    if (!modal) return;

    var accounts = {
      bride: {
        qr: 'assets/images/qr_bride.png',
        bank: 'TECHCOMBANK',
        acc: '19033445566778',
        name: 'NGUYEN VAN ANH'
      },
      groom: {
        qr: 'assets/images/qr_groom.png',
        bank: 'VIETCOMBANK',
        acc: '0071000889900',
        name: 'DUONG DUY NAM'
      }
    };

    function switchRecipient(key) {
      var data = accounts[key];
      if (!data) return;

      if (qrImg) qrImg.src = data.qr;
      if (bankName) bankName.textContent = data.bank;
      if (accNum) accNum.textContent = data.acc;
      if (accName) accName.textContent = data.name;
      if (copyBtn) copyBtn.setAttribute('data-copy-account', data.acc);

      tabs.forEach(function (tab) {
        var isCurrent = tab.getAttribute('data-recipient') === key;
        tab.classList.toggle('is-active', isCurrent);
        tab.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var rec = tab.getAttribute('data-recipient');
        switchRecipient(rec);
      });
    });

    function openModal() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    openBtns.forEach(function (btn) {
      btn.addEventListener('click', openModal);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5. Unified Blessing Note & RSVP Attendance                         */
  /* ------------------------------------------------------------------ */
  function initUnifiedBlessing() {
    var form = document.querySelector('[data-unified-form]');
    var list = document.querySelector('[data-guestbook-list]');
    var aiBtn = document.querySelector('[data-ai-wish-btn]');
    var nameInput = document.querySelector('#blessing-name');
    var msgInput = document.querySelector('#blessing-message');
    var feedback = document.querySelector('[data-blessing-feedback]');
    var guestsWrap = document.querySelector('#blessing-guests-wrap');
    var attendingRadios = document.querySelectorAll('input[name="attending"]');
    if (!list) return;

    var storageKey = 'hydrangea_editorial_wishes';

    var sampleWishes = [
      'Chúc hai bạn trăm năm tình viên mãn, bạc đầu nghĩa phu thê! Mãi yêu thương và thấu hiểu nhau.',
      'Mừng ngày chung đôi của Duy Nam & Vân Anh! Chúc tổ ấm nhỏ luôn ngập tràn tiếng cười và bình yên.',
      'Chúc tình yêu của hai bạn mãi xanh ngát, dịu dàng và bền chặt như sắc hoa cẩm tú cầu tím.',
      'Một hành trình mới thật đẹp đẽ đang mở ra. Chúc hai bạn luôn là điểm tựa bình yên nhất của nhau!',
      'Chúc cô dâu chú rể trăm năm hạnh phúc, sớm đón thiên thần nhỏ đáng yêu!'
    ];

    var defaultEntries = [
      { name: 'Anh Tuấn & Chị Mai', message: 'Chúc mừng hạnh phúc hai em! Một đám cưới thật ngọt ngào, trang nhã và ấm cúng.', time: 'Hôm nay' },
      { name: 'Hội Bạn Thân Đại Học', message: 'Mừng bạn mình đã tìm được bến đỗ bình yên. Chúc hai bạn mãi luôn giữ nụ cười rạng rỡ này!', time: 'Hôm qua' },
      { name: 'Gia đình Bác Kiên', message: 'Chúc hai cháu luôn yêu thương, hòa thuận và cùng nhau xây đắp tương lai rực rỡ!', time: '18/01' }
    ];

    function loadWishes() {
      try {
        var data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : defaultEntries;
      } catch (e) {
        return defaultEntries;
      }
    }

    function saveWishes(arr) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(arr));
      } catch (e) {
        console.error(e);
      }
    }

    function renderWishes() {
      var wishes = loadWishes();
      list.innerHTML = '';
      wishes.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'wish-entry';
        card.innerHTML =
          '<div class="wish-author">' +
            '<span>' + escapeHTML(item.name) + '</span>' +
            '<span class="wish-time">' + escapeHTML(item.time) + '</span>' +
          '</div>' +
          '<p class="wish-text">“' + escapeHTML(item.message) + '”</p>';
        list.appendChild(card);
      });
    }

    attendingRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (guestsWrap) {
          guestsWrap.style.display = (r.value === 'yes') ? 'block' : 'none';
        }
      });
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = nameInput ? nameInput.value.trim() : '';
        var msg = msgInput ? msgInput.value.trim() : '';
        if (!name || !msg) return;

        var attendingRadio = form.querySelector('input[name="attending"]:checked');
        var attending = attendingRadio ? attendingRadio.value : 'yes';
        var guestsEl = form.querySelector('#blessing-guests');
        var guests = (guestsEl && attending === 'yes') ? guestsEl.value : '1';

        // Prepend to live wishes journal
        var wishes = loadWishes();
        wishes.unshift({ name: name, message: msg, time: 'Vừa xong' });
        saveWishes(wishes);
        renderWishes();

        // Personalized feedback notice
        if (feedback) {
          feedback.textContent = (attending === 'yes')
            ? '✓ Cảm ơn ' + name + '! Lời chúc phúc và xác nhận tham dự (' + guests + ' khách) đã được ghi nhận.'
            : '✓ Cảm ơn ' + name + '! Lời chúc tốt đẹp của bạn là món quà quý giá gửi tới đôi uyên ương.';
          feedback.classList.add('is-visible');
        }

        if (nameInput) nameInput.value = '';
        if (msgInput) msgInput.value = '';

        showToast('✓ Lời chúc & phản hồi của bạn đã được ghi nhận!');
      });
    }

    if (aiBtn && msgInput) {
      aiBtn.addEventListener('click', function () {
        var rand = sampleWishes[Math.floor(Math.random() * sampleWishes.length)];
        msgInput.value = rand;
        msgInput.focus();
      });
    }

    renderWishes();
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, function (tag) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 6. Romantic Wedding Ambient Music Player                           */
  /* ------------------------------------------------------------------ */
  function initMusic() {
    var btn = document.getElementById('music-toggle');
    var audio = document.getElementById('bg-audio');
    if (!btn || !audio) return;

    var isPlaying = false;

    function play() {
      isPlaying = true;
      btn.classList.add('is-playing');
      btn.setAttribute('aria-pressed', 'true');
      var p = audio.play();
      if (p && p.catch) {
        p.catch(function (err) {
          console.log('Audio notice:', err.message || err);
        });
      }
    }

    function pause() {
      audio.pause();
      isPlaying = false;
      btn.classList.remove('is-playing');
      btn.setAttribute('aria-pressed', 'false');
    }

    btn.addEventListener('click', function () {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    });

    document.addEventListener('click', function firstInteraction(e) {
      if (e.target && e.target.closest('#music-toggle')) {
        return;
      }
      if (!isPlaying) {
        play();
      }
    }, { once: true });
  }

  /* ------------------------------------------------------------------ */
  /* 7. Subtle Scroll Reveal Observer                                   */
  /* ------------------------------------------------------------------ */
  function initScrollObserver() {
    if (!('IntersectionObserver' in window)) return;

    var elements = document.querySelectorAll('.editorial-scene, .lookbook-entry, .stem-milestone');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in-view');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.08
    });

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

})();
