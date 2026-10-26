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
    applySectionToggles(window.invitationData);
        initMusic();
    initScrollObserver();
    initMapDirections();
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

    window.__wwHasCustomCountdown = true;

    function getTarget() {
      var inv = window.invitationData || {};
      var raw = inv.ceremony_date || inv.reception_date || el.getAttribute('data-countdown');
      if (!raw) return 0;
      var t = new Date(raw).getTime();
      return isNaN(t) ? 0 : t;
    }

    var targetDate = getTarget();
    var daysSpan = el.querySelector('[data-unit="days"]');
    var hoursSpan = el.querySelector('[data-unit="hours"]');
    var minutesSpan = el.querySelector('[data-unit="minutes"]');
    var secondsSpan = el.querySelector('[data-unit="seconds"]');

    var now = Date.now();
    if (!targetDate || targetDate <= now) {
      targetDate = now + (23 * 24 * 60 * 60 * 1000) + (7 * 60 * 60 * 1000) + (12 * 60 * 1000) + (35 * 1000);
    }

    function updateTimer() {
      var realTarget = getTarget();
      var current = Date.now();
      var activeTarget = (realTarget && realTarget > current) ? realTarget : targetDate;
      var diff = activeTarget - current;
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

    window.__wwUpdateCountdown = updateTimer;

    updateTimer();
    if (window.__wwCountdownInterval) clearInterval(window.__wwCountdownInterval);
    window.__wwCountdownInterval = setInterval(updateTimer, 1000);
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
  /* 4. Stationery Gift Popup Modal (Hộp quà mừng cưới)                */
  /* ------------------------------------------------------------------ */
  
  /* ------------------------------------------------------------------ */
  /* Display Toggles: RSVP, Wishes, Wishes List, Gift Box, Background   */
  /* ------------------------------------------------------------------ */
  function applySectionToggles(data) {
    var d = data || window.invitationData || {};
    var extra = d.extra_data || {};

    // One editable accent controls the former lavender/mauve ink and its soft paper shadows.
    // Strict HEX validation keeps the value safe before it is written into a stylesheet.
    var accentColor = String(extra.accent_color || d.accent_color || '').trim();
    accentColor = /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '';
    var accentStyleEl = document.getElementById('theme-custom-accent-color-style');
    if (accentColor) {
      var accentRgb = {
        r: parseInt(accentColor.slice(1, 3), 16),
        g: parseInt(accentColor.slice(3, 5), 16),
        b: parseInt(accentColor.slice(5, 7), 16)
      };
      var mixColor = function (target, amount) {
        var tr = parseInt(target.slice(1, 3), 16);
        var tg = parseInt(target.slice(3, 5), 16);
        var tb = parseInt(target.slice(5, 7), 16);
        var toHex = function (value) { return Math.round(value).toString(16).padStart(2, '0'); };
        return '#' + toHex(accentRgb.r + (tr - accentRgb.r) * amount) + toHex(accentRgb.g + (tg - accentRgb.g) * amount) + toHex(accentRgb.b + (tb - accentRgb.b) * amount);
      };
      if (!accentStyleEl) {
        accentStyleEl = document.createElement('style');
        accentStyleEl.id = 'theme-custom-accent-color-style';
        document.head.appendChild(accentStyleEl);
      }
      accentStyleEl.textContent =
        ':root { ' +
        '--hydrangea-subtle:' + mixColor('#FFFFFF', 0.92) + ' !important; ' +
        '--hydrangea-tint:' + mixColor('#FFFFFF', 0.82) + ' !important; ' +
        '--hydrangea-pale:' + mixColor('#FFFFFF', 0.68) + ' !important; ' +
        '--hydrangea-mid:' + accentColor + ' !important; ' +
        '--hydrangea-deep:' + mixColor('#241D21', 0.36) + ' !important; ' +
        '--hydrangea-dark:' + mixColor('#241D21', 0.56) + ' !important; ' +
        '--sage-accent:' + accentColor + ' !important; ' +
        '--hairline-rule:rgba(' + accentRgb.r + ',' + accentRgb.g + ',' + accentRgb.b + ',0.22) !important; ' +
        '--envelope-shadow:rgba(' + accentRgb.r + ',' + accentRgb.g + ',' + accentRgb.b + ',0.14) !important; ' +
        '--envelope-edge-shadow:rgba(' + accentRgb.r + ',' + accentRgb.g + ',' + accentRgb.b + ',0.07) !important; ' +
        '--letter-shadow:rgba(' + accentRgb.r + ',' + accentRgb.g + ',' + accentRgb.b + ',0.13) !important; ' +
        '}';
    } else if (accentStyleEl) {
      accentStyleEl.remove();
    }

    var showRsvp = (extra.show_rsvp !== undefined) ? Boolean(extra.show_rsvp) : (d.show_rsvp !== undefined ? Boolean(d.show_rsvp) : true);
    var allowWishes = (extra.allow_wishes !== undefined) ? Boolean(extra.allow_wishes) : (d.allow_wishes !== undefined ? Boolean(d.allow_wishes) : true);
    var showWishesList = (extra.show_wishes_list !== undefined) ? Boolean(extra.show_wishes_list) : (d.show_wishes_list !== undefined ? Boolean(d.show_wishes_list) : true);
    var showGiftBox = (extra.show_gift_box !== undefined) ? Boolean(extra.show_gift_box) : (d.show_gift_box !== undefined ? Boolean(d.show_gift_box) : true);
    var bgColor = extra.background_color || d.background_color || '';
    var bgColorStyleEl = document.getElementById('theme-custom-bg-color-style');
    if (bgColor) {
      if (!bgColorStyleEl) {
        bgColorStyleEl = document.createElement('style');
        bgColorStyleEl.id = 'theme-custom-bg-color-style';
        document.head.appendChild(bgColorStyleEl);
      }
      bgColorStyleEl.textContent =
        ':root { ' +
        '  --paper-ivory: ' + bgColor + ' !important; ' +
        '  --paper-cream: ' + bgColor + ' !important; ' +
        '} ' +
        'body, .editorial-canvas, .editorial-scene, .scene-hero, .scene-couple, .scene-events, .scene-calendar, .scene-gallery, .scene-blessing, .editorial-finale, .stationery-form { ' +
        '  background-color: ' + bgColor + ' !important; ' +
        '  background-image: none !important; ' +
        '}';
    } else if (bgColorStyleEl) {
      bgColorStyleEl.remove();
    }

    var bgImage = extra.background_image || d.background_image || '';

    // Áp dụng ảnh nền tuỳ biến
    var bgStyleEl = document.getElementById('theme-custom-bg-style');
    if (bgImage) {
      if (!bgStyleEl) {
        bgStyleEl = document.createElement('style');
        bgStyleEl.id = 'theme-custom-bg-style';
        document.head.appendChild(bgStyleEl);
      }
      bgStyleEl.textContent =
        'body, .editorial-canvas { ' +
        '  background-image: url("' + bgImage + '") !important;' +
        '  background-size: cover !important;' +
        '  background-position: center !important;' +
        '  background-attachment: fixed !important;' +
        '  background-repeat: no-repeat !important;' +
        '} ' +
        '.editorial-canvas::before { ' +
        '  content: ""; position: fixed; inset: 0; background: rgba(250, 247, 242, 0.78); pointer-events: none; z-index: 0; ' +
        '} ' +
        '.editorial-scene, .editorial-finale, .scene-hero { position: relative; z-index: 1; background-color: transparent !important; }';
    } else if (bgStyleEl) {
      bgStyleEl.remove();
    }

    var blessingSection = document.getElementById('blessing');
    var galleryGiftBlock = document.getElementById('gallery-gift-block');
    var form = document.querySelector('[data-unified-form]');
    var attendanceBlock = document.querySelector('.blessing-attendance-block');
    var guestsWrap = document.querySelector('#blessing-guests-wrap');
    var msgInput = document.querySelector('#blessing-message');
    var msgWrap = msgInput ? msgInput.closest('.form-field-hairline') : null;
    var submitRow = document.querySelector('.blessing-submit-row');
    var submitBtn = submitRow ? submitRow.querySelector('button[type="submit"]') : null;
    var actionsDivider = document.querySelector('.blessing-actions-divider');
    var blessingGiftAction = document.querySelector('.blessing-gift-action');
    var journalBlock = document.querySelector('.blessing-journal-block');

    var rsvpOff = !showRsvp;
    var wishesAllOff = (!allowWishes && !showWishesList);

    // Điều kiện: nếu cả 1 (RSVP) và 2 (gửi lời chúc + danh sách lời chúc) đều tắt, mà 3 (hộp quà) bật:
    if (rsvpOff && wishesAllOff && showGiftBox) {
      var isEditMode = (typeof window.__weddingWebEditMode !== 'undefined' && window.__weddingWebEditMode);
      if (isEditMode) {
        if (blessingSection) {
          blessingSection.style.removeProperty('display');
          blessingSection.style.opacity = '0.4';
          var oldBanner = blessingSection.querySelector('.ww-off-banner-blessing');
          if (!oldBanner) {
            blessingSection.insertAdjacentHTML('afterbegin', '<div class="ww-off-banner ww-off-banner-blessing" data-edit-blessing style="cursor:pointer;margin:16px auto;max-width:420px;text-align:center;padding:10px 16px;background:#fff4eb;border:1px dashed #e28a55;border-radius:10px;color:#a04b1e;font-size:12px;font-weight:600;">⚠️ Phần Lời chúc & Xác nhận tham gia đang TẮT (khách xem sẽ không thấy). Bấm để cài đặt hoặc bật lại.</div>');
          }
        }
      } else {
        if (blessingSection) blessingSection.style.display = 'none';
      }
      if (galleryGiftBlock) {
        galleryGiftBlock.style.display = 'block';
        galleryGiftBlock.setAttribute('data-edit-blessing', 'true');
      }
    } else if (rsvpOff && wishesAllOff && !showGiftBox) {
      if (blessingSection) blessingSection.style.display = 'none';
      if (galleryGiftBlock) galleryGiftBlock.style.display = 'none';
    } else {
      if (blessingSection) {
        blessingSection.style.display = '';
        blessingSection.style.removeProperty('opacity');
        var bannerBl = blessingSection.querySelector('.ww-off-banner-blessing');
        if (bannerBl) bannerBl.remove();

        var isEditMode = (typeof window.__weddingWebEditMode !== 'undefined' && window.__weddingWebEditMode);
        if (isEditMode) {
          var bHeader = blessingSection.querySelector('.blessing-header');
          if (bHeader && !bHeader.querySelector('.ww-blessing-edit-badge')) {
            bHeader.insertAdjacentHTML('beforeend', '<div style="margin-top:12px;margin-bottom:8px;"><button type="button" class="ww-blessing-edit-badge" data-edit-blessing style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 16px;background:rgba(255,255,255,0.9);border:1px solid #d9cebe;border-radius:20px;font-size:12px;color:#6e5845;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.05);transition:all .2s ease;">💌 Bật/Tắt Lời chúc &amp; Tham dự</button></div>');
          }
        }
      }
      if (galleryGiftBlock) galleryGiftBlock.style.display = 'none';

      // Chi tiết từng khối trong blessing:
      if (attendanceBlock) attendanceBlock.style.display = showRsvp ? '' : 'none';
      if (guestsWrap) {
        if (!showRsvp) {
          guestsWrap.style.display = 'none';
        } else {
          var yesChecked = document.querySelector('input[name="attending"][value="yes"]:checked');
          guestsWrap.style.display = yesChecked ? '' : 'none';
        }
      }

      if (msgWrap) msgWrap.style.display = allowWishes ? '' : 'none';
      if (msgInput) {
        if (allowWishes) {
          msgInput.setAttribute('required', 'required');
        } else {
          msgInput.removeAttribute('required');
        }
      }

      if (!showRsvp && !allowWishes) {
        if (form) form.style.display = 'none';
      } else {
        if (form) form.style.display = '';
        if (submitRow) submitRow.style.display = '';
        if (submitBtn) {
          if (showRsvp && allowWishes) {
            submitBtn.textContent = 'GỬI LỜI CHÚC & XÁC NHẬN';
          } else if (showRsvp && !allowWishes) {
            submitBtn.textContent = 'XÁC NHẬN THAM DỰ';
          } else if (!showRsvp && allowWishes) {
            submitBtn.textContent = 'GỬI LỜI CHÚC';
          }
        }
      }

      if (journalBlock) journalBlock.style.display = showWishesList ? '' : 'none';
      if (blessingGiftAction) blessingGiftAction.style.display = showGiftBox ? '' : 'none';
      if (actionsDivider) {
        actionsDivider.style.display = (showGiftBox && (showRsvp || allowWishes)) ? '' : 'none';
      }
    }
  }

  window.__wwApplyDisplayToggles = applySectionToggles;

  function initGiftModal() {
    var modal = document.getElementById('gift-modal');
    var openBtns = document.querySelectorAll('[data-open-gift-modal]');
    var closeBtn = document.getElementById('gift-modal-close');
    var qrImg = document.getElementById('single-gift-qr');
    var bankName = document.getElementById('gift-modal-bank');
    var accNum = document.getElementById('gift-modal-acc-num');
    var accName = document.getElementById('gift-modal-acc-name');
    var copyBtn = document.getElementById('gift-modal-copy-btn');
    var tabsRow = document.querySelector('.recipient-switcher-row');
    var tabBride = document.querySelector('.recipient-tab[data-recipient="bride"]');
    var tabGroom = document.querySelector('.recipient-tab[data-recipient="groom"]');
    var tabs = document.querySelectorAll('.recipient-tab');

    if (!modal) return;

    var currentRecipient = 'bride';
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
      currentRecipient = key;
      var data = accounts[key] || accounts.bride || accounts.groom;
      if (!data) return;

      if (qrImg) qrImg.src = data.qr;
      if (bankName) bankName.textContent = data.bank || '';
      if (accNum) accNum.textContent = data.acc || '';
      if (accName) accName.textContent = data.name || '';
      if (copyBtn) copyBtn.setAttribute('data-copy-account', data.acc || '');

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

    function updateGiftModal(data) {
      var inv = data || window.invitationData || {};
      var extraBank = (inv.extra_data && inv.extra_data.bank) || inv.bank || {};
      var groomBank = extraBank.groom || {};
      var brideBank = extraBank.bride || {};

      // Detect QR images from invitation images array
      var imgList = inv.images || inv.invitation_images || [];
      var groomQrFromImages = null;
      var brideQrFromImages = null;
      for (var i = 0; i < imgList.length; i++) {
        var im = imgList[i];
        if (im && im.image_type === 'bank_qr' && im.image_url) {
          if (im.sort_order === 1) brideQrFromImages = im.image_url;
          else if (im.sort_order === 0) groomQrFromImages = im.image_url;
          else if (!groomQrFromImages) groomQrFromImages = im.image_url;
          else if (!brideQrFromImages) brideQrFromImages = im.image_url;
        }
      }

      // Names & Tab Labels
      var groomName = (inv.groom_name || (inv.groom && inv.groom.name_groom) || 'Chú Rể').trim();
      var brideName = (inv.bride_name || (inv.bride && inv.bride.name_bride) || 'Cô Dâu').trim();
      var groomShort = inv.groom_short_name || groomName.split(/\s+/).pop() || '';
      var brideShort = inv.bride_short_name || brideName.split(/\s+/).pop() || '';

      var groomTabLabel = 'Chú Rể';
      if (groomShort && groomShort.toLowerCase() !== 'rể' && groomShort.toLowerCase() !== 'chú rể') {
        groomTabLabel += ' ' + groomShort;
      } else if (groomName && groomName.toLowerCase() !== 'chú rể') {
        groomTabLabel += ' ' + groomName;
      }

      var brideTabLabel = 'Cô Dâu';
      if (brideShort && brideShort.toLowerCase() !== 'dâu' && brideShort.toLowerCase() !== 'cô dâu') {
        brideTabLabel += ' ' + brideShort;
      } else if (brideName && brideName.toLowerCase() !== 'cô dâu') {
        brideTabLabel += ' ' + brideName;
      }

      if (tabBride) tabBride.textContent = brideTabLabel;
      if (tabGroom) tabGroom.textContent = groomTabLabel;

      // Groom Account
      var gQr = groomBank.qr_image || groomQrFromImages || 'assets/images/qr_groom.png';
      var gBank = groomBank.bank_short_name || groomBank.bank_name || (inv.groom && inv.groom.bank_name) || (extraBank.bank_short_name || extraBank.bank_name) || 'VIETCOMBANK';
      var gAcc = groomBank.bank_account_number || (inv.groom && inv.groom.bank_account_number) || (extraBank.bank_account_number) || '0071000889900';
      var gName = groomBank.bank_account_name || (inv.groom && inv.groom.bank_account_name) || (extraBank.bank_account_name) || groomName.toUpperCase() || 'DUONG DUY NAM';

      // Bride Account
      var bQr = brideBank.qr_image || brideQrFromImages || 'assets/images/qr_bride.png';
      var bBank = brideBank.bank_short_name || brideBank.bank_name || (inv.bride && inv.bride.bank_name) || (extraBank.bank_short_name || extraBank.bank_name) || 'TECHCOMBANK';
      var bAcc = brideBank.bank_account_number || (inv.bride && inv.bride.bank_account_number) || (extraBank.bank_account_number) || '19033445566778';
      var bName = brideBank.bank_account_name || (inv.bride && inv.bride.bank_account_name) || (extraBank.bank_account_name) || brideName.toUpperCase() || 'NGUYEN VAN ANH';

      accounts = {
        groom: { qr: gQr, bank: gBank, acc: gAcc, name: gName },
        bride: { qr: bQr, bank: bBank, acc: bAcc, name: bName }
      };

      // Determine display mode: 'both' | 'groom' | 'bride'
      var mode = extraBank.display_mode;
      if (!mode) {
        var hasRealGroom = Boolean(groomBank.bank_account_number || (inv.groom && inv.groom.bank_account_number));
        var hasRealBride = Boolean(brideBank.bank_account_number || (inv.bride && inv.bride.bank_account_number));
        if (hasRealGroom && !hasRealBride) mode = 'groom';
        else if (hasRealBride && !hasRealGroom) mode = 'bride';
        else mode = 'both';
      }

      if (mode === 'groom') {
        // Chỉ hiển thị Chú rể: ẩn nút chuyển chọn ("không có cái chọn này"), hiển thị trực tiếp Chú rể
        if (tabsRow) tabsRow.style.display = 'none';
        switchRecipient('groom');
      } else if (mode === 'bride') {
        // Chỉ hiển thị Cô dâu: ẩn nút chuyển chọn ("không có cái chọn này"), hiển thị trực tiếp Cô dâu
        if (tabsRow) tabsRow.style.display = 'none';
        switchRecipient('bride');
      } else {
        // Hiển thị cả hai: có nút chọn (tabs switcher) để khách chọn người nhận
        if (tabsRow) tabsRow.style.display = 'flex';
        var nextActive = (currentRecipient === 'groom') ? 'groom' : 'bride';
        switchRecipient(nextActive);
      }
    }

    // Expose for external live update from templateEngine
    window.__wwUpdateGiftModal = updateGiftModal;

    // Run initially
    updateGiftModal(window.invitationData);

    // 1-Click Copy STK
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var acc = copyBtn.getAttribute('data-copy-account') || (accNum ? accNum.textContent.trim() : '');
        if (!acc) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(acc).then(function () {
            showToast('✓ Đã sao chép số tài khoản: ' + acc);
          }).catch(function () {
            prompt('Sao chép số tài khoản:', acc);
          });
        } else {
          prompt('Sao chép số tài khoản:', acc);
        }
      });
    }

    function openModal() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      updateGiftModal(window.invitationData);
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
    document.addEventListener('click', function(e) {
      var trigger = e.target && e.target.closest && e.target.closest('[data-open-gift-modal]');
      if (trigger) {
        e.preventDefault();
        openModal();
      }
    });

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

    var inv = window.invitationData || {};
    var invId = inv.id || inv.invitation_id || '';
    var apiBase = inv.api_base || '';
    if (!apiBase && typeof window !== 'undefined') {
      apiBase = window.location.origin;
    }
    var storageKey = 'hydrangea_editorial_wishes_' + (invId || 'default');

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

    function formatTime(d) {
      if (!d) return 'Vừa xong';
      try {
        var dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        var now = new Date();
        var diffSec = Math.floor((now - dt) / 1000);
        if (diffSec < 60) return 'Vừa xong';
        if (diffSec < 3600) return Math.floor(diffSec / 60) + ' phút trước';
        if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' giờ trước';
        return dt.toLocaleDateString('vi-VN');
      } catch (e) {
        return 'Vừa xong';
      }
    }

    function renderEntries(entries) {
      list.innerHTML = '';
      if (!entries || !entries.length) {
        list.innerHTML = '<p style="text-align:center;font-style:italic;color:var(--hydrangea-mid, #7A6890);font-size:12.5px;padding:16px 0;opacity:0.85;">Chưa có lời chúc nào. Hãy là người đầu tiên gửi lời chúc tới đôi uyên ương!</p>';
        return;
      }
      entries.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'wish-entry';
        var nameStr = item.name || item.name_guest || 'Khách mời';
        var timeStr = item.time || formatTime(item.date || item.created_at);
        var msgStr = item.message || item.messages || '';
        card.innerHTML =
          '<div class="wish-author">' +
            '<span>' + escapeHTML(nameStr) + '</span>' +
            '<span class="wish-time">' + escapeHTML(timeStr) + '</span>' +
          '</div>' +
          '<p class="wish-text">“' + escapeHTML(msgStr) + '”</p>';
        list.appendChild(card);
      });
    }

    
    function sortWishesDesc(arr) {
      if (!Array.isArray(arr)) return [];
      return arr.slice().sort(function (a, b) {
        var tA = a.created_at || a.date || (a.time === 'Vừa xong' ? Date.now() : a.time);
        var tB = b.created_at || b.date || (b.time === 'Vừa xong' ? Date.now() : b.time);
        return new Date(tB || 0) - new Date(tA || 0);
      });
    }

    function loadWishes(silent) {
      window.loadWishes = loadWishes;
      var currentInv = window.invitationData || inv || {};
      var curId = invId || currentInv.id || currentInv.invitation_id || '';
      var curBase = apiBase || currentInv.api_base || (typeof window !== 'undefined' ? window.location.origin : '');

      // 1. Initial display from cache or preloaded wishes
      try {
        if (Array.isArray(currentInv.wishes)) {
          if (currentInv.wishes.length > 0) {
            renderEntries(sortWishesDesc(currentInv.wishes));
          } else {
            renderEntries([]);
            try { localStorage.removeItem(storageKey); } catch (e) {}
          }
        } else {
          var local = localStorage.getItem(storageKey);
          if (local) {
            var parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              renderEntries(sortWishesDesc(parsed));
            }
          }
        }
      } catch (e) {}

      // 2. Fetch live wishes from backend API if ID exists
      if (curId) {
        fetch(curBase + '/api/messages-checkins/public/' + curId)
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (json && json.success && Array.isArray(json.data)) {
              if (json.data.length > 0) {
                renderEntries(sortWishesDesc(json.data));
                try { localStorage.setItem(storageKey, JSON.stringify(json.data)); } catch (e) {}
              } else {
                renderEntries([]);
                try { localStorage.removeItem(storageKey); } catch (e) {}
              }
            }
          })
          .catch(function (err) {
            console.warn('Could not load public wishes:', err);
          });
      }
    }

    attendingRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (guestsWrap) {
          guestsWrap.style.display = (r.value === 'yes') ? 'block' : 'none';
        }
      });
    });

    if (form) {
      var isSubmitting = false;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (isSubmitting) return;
        var now = Date.now();
        if (form._lastSubmit && (now - form._lastSubmit < 3000)) return;

        var name = nameInput ? nameInput.value.trim() : '';
        var msg = msgInput ? msgInput.value.trim() : '';
        if (!name || !msg) return;

        isSubmitting = true;
        form._lastSubmit = now;
        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        var attendingRadio = form.querySelector('input[name="attending"]:checked');
        var attending = attendingRadio ? attendingRadio.value : 'yes';
        var guestsEl = form.querySelector('#blessing-guests');
        var guests = (guestsEl && attending === 'yes') ? (parseInt(guestsEl.value, 10) || 1) : 0;

        var newEntry = { name: name, message: msg, time: 'Vừa xong' };

        // Post to backend database
        if (invId) {
          fetch(apiBase + '/api/messages-checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invitation_id: invId,
              name: name,
              message: msg,
              attending: attending,
              count: guests
            })
          })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            console.log('Checkin saved to database:', res);
            loadWishes(true); // reload live
          })
          .catch(function (err) {
            console.warn('Could not post checkin:', err);
          })
          .finally(function() {
            setTimeout(function() {
              isSubmitting = false;
              if (submitBtn) submitBtn.disabled = false;
            }, 1500);
          });
        } else {
          setTimeout(function() {
            isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
          }, 1500);
        }

        // Prepend to current entries and update UI
        var currentEntries = [];
        try {
          var saved = localStorage.getItem(storageKey);
          currentEntries = saved ? JSON.parse(saved) : (Array.isArray(inv.wishes) && inv.wishes.length ? inv.wishes.slice() : defaultEntries.slice());
        } catch (e) {
          currentEntries = defaultEntries.slice();
        }
        currentEntries.unshift(newEntry);
        try { localStorage.setItem(storageKey, JSON.stringify(currentEntries)); } catch (e) {}
        renderEntries(currentEntries);

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

    loadWishes();
    setInterval(function () {
      if (document.visibilityState === 'visible') {
        loadWishes(true);
      }
    }, 3500);

    // Listen for data updates (editor live update or iframe message)
    window.addEventListener('message', function (ev) {
      if (ev.data && (ev.data.type === 'SET_INVITATION' || ev.data.type === 'wedding-web:update-data')) {
        var incoming = ev.data.invitation || ev.data.data;
        if (incoming && incoming.id) {
          invId = incoming.id;
          storageKey = 'hydrangea_editorial_wishes_' + invId;
          loadWishes();
          applySectionToggles(incoming);
        }
      }
    });
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
    var audio = document.getElementById('bg-audio') || document.querySelector('audio');
    if (!btn || !audio) return;

    function updateUi() {
      if (!audio.paused) {
        btn.classList.add('is-playing');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('is-playing');
        btn.setAttribute('aria-pressed', 'false');
      }
    }

    audio.addEventListener('play', updateUi);
    audio.addEventListener('pause', updateUi);
    audio.addEventListener('playing', updateUi);
    audio.addEventListener('ended', updateUi);

    btn.addEventListener('click', function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!audio.paused) {
        window.__wwUserPaused = true;
        audio.pause();
      } else {
        window.__wwUserPaused = false;
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      }
      updateUi();
    });

    document.addEventListener('click', function firstInteraction(e) {
      if (e.target && e.target.closest('#music-toggle, .music-disc-btn')) {
        return;
      }
      if (window.__wwUserPaused) return;
      if (audio.paused) {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      }
    }, { once: true });

    updateUi();
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

  /* ------------------------------------------------------------------ */
  /* 8. Map Directions Handler (Zalo, Messenger & Mobile App Launcher)   */
  /* ------------------------------------------------------------------ */
  function initMapDirections() {
    var mapBtns = document.querySelectorAll(
      '.event-action-pill, [data-field-href="map_url"], [data-field-href="reception_map_url"], a[href*="maps.app.goo.gl"], a[href*="google.com/maps"], a[href*="maps.google.com"]'
    );

    mapBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (window.__weddingWebEditMode) return;

        var href = btn.getAttribute('href') || btn.href;
        var targetUrl = href;

        if (!targetUrl || targetUrl === '#' || targetUrl.indexOf('javascript:') === 0) {
          var node = btn.closest('.event-moment-node') || btn.closest('article') || btn.parentElement;
          var addr = node ? node.querySelector('[data-field*="address"], address') : null;
          if (addr && addr.textContent.trim()) {
            targetUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr.textContent.trim());
          }
        }
        if (!targetUrl || targetUrl === '#') return;

        var ua = (navigator.userAgent || '').toLowerCase();
        var isMobile = /android|iphone|ipad|ipod/i.test(ua);
        var isInApp = ua.indexOf('zalo') !== -1 || ua.indexOf('fbav') !== -1 || ua.indexOf('fban') !== -1 || ua.indexOf('messenger') !== -1;

        if (isMobile || isInApp || window !== window.top) {
          e.preventDefault();
          e.stopPropagation();

          // 1. Gửi message cho window cha (TemplateLoader) điều hướng top-level
          try {
            window.parent.postMessage({ type: 'wedding-web:open-map', url: targetUrl }, '*');
          } catch (_e) {}

          // 2. Thử trực tiếp window.top
          try {
            if (window.top && window.top !== window) {
              window.top.location.href = targetUrl;
              return;
            }
          } catch (_e) {}

          // 3. Điều hướng cửa sổ hiện tại
          window.location.href = targetUrl;
        }
      });
    });
  }

})();
