/**
 * ============================================================
 * MODALS, FORMS & CLIPBOARD CONTROLLER — BLUE BOTANICAL WEDDING
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Toast Notification Helper
  const toastEl = document.getElementById("stationery-toast");
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("active");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("active");
    }, 2800);
  }

  // 2. Generic Modal Open / Close Handler
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  // Bind close buttons and backdrop clicks
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });

    const closeBtn = overlay.querySelector(".modal-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeModal(overlay.id);
      });
    }
  });

  // ESC key to close any active modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach((overlay) => {
        closeModal(overlay.id);
      });
      const lightbox = document.getElementById("gallery-lightbox");
      if (lightbox && lightbox.classList.contains("active")) {
        lightbox.classList.remove("active");
        document.body.style.overflow = "";
      }
    }
  });

  // 3. Gift Modal Trigger & Tabs
  const btnOpenGift = document.getElementById("btn-open-gift");
  if (btnOpenGift) {
    btnOpenGift.addEventListener("click", () => {
      openModal("gift-modal");
    });
  }

  const giftTabs = document.querySelectorAll(".gift-tab-btn");
  giftTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetSide = tab.getAttribute("data-tab");
      giftTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".gift-content-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      const activePanel = document.getElementById(`gift-panel-${targetSide}`);
      if (activePanel) {
        activePanel.classList.add("active");
      }
    });
  });

  // 4. One-Click Copy Account Number with Instant Button & Toast Feedback
  document.querySelectorAll(".btn-copy-account").forEach((btn) => {
    btn.addEventListener("click", () => {
      const accountNum = btn.getAttribute("data-account");
      const originalHTML = btn.innerHTML;
      if (accountNum) {
        const copySuccess = () => {
          btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>ĐÃ CHÉP!</span>`;
          btn.style.background = "#2D6A4F";
          btn.style.borderColor = "#74C69D";
          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = "";
            btn.style.borderColor = "";
          }, 2200);
          showToast(`Đã sao chép số tài khoản: ${accountNum}`);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(accountNum).then(copySuccess).catch(() => {
            const textarea = document.createElement("textarea");
            textarea.value = accountNum;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            copySuccess();
          });
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = accountNum;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          copySuccess();
        }
      }
    });
  });

  // 5. Blessing Modal & Form Handling
  const btnOpenBlessing = document.getElementById("btn-open-blessing");
  const blessingForm = document.getElementById("blessing-form");
  const blessingListContainer = document.getElementById("blessing-list-container");

  if (btnOpenBlessing) {
    btnOpenBlessing.addEventListener("click", () => {
      openModal("blessing-modal");
    });
  }

  if (blessingForm) {
    blessingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("blessing-name");
      const messageInput = document.getElementById("blessing-message");

      const name = nameInput ? nameInput.value.trim() : "";
      const message = messageInput ? messageInput.value.trim() : "";

      if (!name || !message) {
        showToast("Vui lòng nhập tên và lời chúc của bạn");
        return;
      }

      // Add to list UI
      if (blessingListContainer) {
        const newItem = document.createElement("div");
        newItem.className = "blessing-item";
        newItem.innerHTML = `
          <div class="blessing-author-row">
            <span class="blessing-author">${escapeHtml(name)}</span>
            <span class="blessing-time">Vừa xong</span>
          </div>
          <p class="blessing-message">${escapeHtml(message)}</p>
        `;
        blessingListContainer.prepend(newItem);
      }

      // Reset & Close
      blessingForm.reset();
      closeModal("blessing-modal");
      showToast("Cảm ơn bạn đã gửi lời chúc phúc ý nghĩa!");
    });
  }

  // 5b. Unified RSVP & Blessing Form in Gắn Kết section
  const unifiedForm = document.getElementById("unified-rsvp-blessing-form");
  const guestCountWrapper = document.getElementById("guest-count-wrapper");

  // Toggle guest count based on attendance choice
  if (unifiedForm && guestCountWrapper) {
    const attendanceRadios = unifiedForm.querySelectorAll('input[name="attendance"]');
    attendanceRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.value === "declined") {
          guestCountWrapper.style.display = "none";
        } else {
          guestCountWrapper.style.display = "flex";
        }
      });
    });
  }

  if (unifiedForm) {
    unifiedForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("unified-guest-name");
      const attendance = unifiedForm.querySelector('input[name="attendance"]:checked');
      const countSelect = document.getElementById("unified-guest-count");
      const msgInput = document.getElementById("unified-blessing-msg");

      const guestName = nameInput ? nameInput.value.trim() : "Quý khách";
      const isAttending = attendance ? attendance.value === "attending" : true;
      const guestCount = countSelect ? countSelect.value : "1 người";
      const message = msgInput ? msgInput.value.trim() : "";

      if (!guestName || !message) {
        showToast("Vui lòng điền họ tên và lời chúc của bạn nhé!");
        return;
      }

      // Add to Guestbook Ticker UI
      if (blessingListContainer) {
        const newItem = document.createElement("div");
        newItem.className = "blessing-item";
        newItem.style.animation = "fadeInHighlight 0.6s ease";
        newItem.innerHTML = `
          <div class="blessing-author-row">
            <span class="blessing-author">${escapeHtml(guestName)} ${isAttending ? '<span class="blessing-badge-attending">✦ Sẽ tham dự</span>' : ''}</span>
            <span class="blessing-time">Vừa xong</span>
          </div>
          <p class="blessing-message">${escapeHtml(message)}</p>
        `;
        blessingListContainer.prepend(newItem);
      }

      // Feedback Toast
      if (isAttending) {
        showToast(`Cảm ơn ${guestName}! Lời chúc và xác nhận tham dự (${guestCount}) của bạn đã được gửi thành công.`);
      } else {
        showToast(`Cảm ơn ${guestName}! Lời chúc phúc chân thành của bạn đã được gửi đến dâu rể.`);
      }

      unifiedForm.reset();
      if (guestCountWrapper) guestCountWrapper.style.display = "flex";
    });
  }

  // 6. RSVP Modal & Form Handling (Fallback & Modal support)
  const btnOpenRsvp = document.getElementById("btn-open-rsvp");
  const rsvpForm = document.getElementById("rsvp-form");

  if (btnOpenRsvp) {
    btnOpenRsvp.addEventListener("click", () => {
      openModal("rsvp-modal");
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("rsvp-name");
      const guestName = nameInput ? nameInput.value.trim() : "Quý khách";

      showToast(`Cảm ơn ${guestName}! Lời xác nhận của bạn đã được ghi nhận.`);
      rsvpForm.reset();
      closeModal("rsvp-modal");
    });
  }

  // 7. Dynamic Invitation Day Rendering (MEAL_ONLY vs WEDDING_CEREMONY)
  function initInvitationDay() {
    if (typeof weddingData === "undefined" || !weddingData.invitationTypes) return;
    const urlParams = new URLSearchParams(window.location.search);
    const paramType = urlParams.get("type");
    let currentType = "WEDDING_CEREMONY";
    if (paramType === "meal" || paramType === "MEAL_ONLY") {
      currentType = "MEAL_ONLY";
    } else if (paramType === "ceremony" || paramType === "WEDDING_CEREMONY") {
      currentType = "WEDDING_CEREMONY";
    } else if (weddingData.invitationType) {
      currentType = weddingData.invitationType;
    }

    const config = weddingData.invitationTypes[currentType] || weddingData.invitationTypes.WEDDING_CEREMONY;
    const timeEl = document.getElementById("invitation-time-val");
    const lunarEl = document.getElementById("invitation-lunar-val");
    const venueEl = document.getElementById("invitation-venue-val");
    const addressEl = document.getElementById("invitation-address-val");

    // Ghi vào các ô con [data-field] nếu có, thay vì thay sạch textContent.
    //
    // Vì sao: trong hệ thống thiệp, nền tảng gắn [data-field] lên từng mảnh nhỏ để
    // chủ thiệp bấm sửa trực tiếp. Viết đè cả khối sẽ XOÁ các ô đó — dữ liệu vẫn
    // hiện đúng nhưng mất hẳn khả năng sửa tại chỗ.
    const setPart = (host, field, value) => {
      if (!host) return;
      const slot = host.querySelector(`[data-field="${field}"]`);
      if (slot) { slot.textContent = value; return true; }
      return false;
    };

    if (timeEl) {
      const a = setPart(timeEl, "reception_time", config.time);
      const b = setPart(timeEl, "reception_weekday", config.dayOfWeek);
      const c = setPart(timeEl, "reception_short", config.date);
      // Mẫu chạy độc lập (chưa gắn data-field) -> giữ nguyên hành vi cũ.
      if (!a && !b && !c) timeEl.textContent = `${config.time} · ${config.dayOfWeek}, ${config.date}`;
    }
    if (lunarEl) lunarEl.textContent = `(${String(config.lunarDate).replace(/^\(|\)$/g, "")})`;
    if (venueEl) venueEl.textContent = config.venueName + (config.hall ? ` · ${config.hall}` : "");
    if (addressEl) addressEl.textContent = config.address;
  }

  initInvitationDay();

  // XSS sanitizer helper
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});

