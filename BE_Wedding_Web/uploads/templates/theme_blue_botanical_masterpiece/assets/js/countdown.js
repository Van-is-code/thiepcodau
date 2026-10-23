/**
 * ============================================================
 * EDITORIAL COUNTDOWN CONTROLLER — BLUE BOTANICAL WEDDING
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const daysEl = document.getElementById("countdown-days");
  const hoursEl = document.getElementById("countdown-hours");
  const minutesEl = document.getElementById("countdown-minutes");
  const secondsEl = document.getElementById("countdown-seconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  function getTargetTime() {
    const raw = (window.invitationData && (window.invitationData.ceremony_date || window.invitationData.reception_date))
      || (window.weddingData && window.weddingData.eventTime && window.weddingData.eventTime.isoDateTime)
      || "2025-04-26T11:00:00+07:00";
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date("2025-04-26T11:00:00+07:00").getTime() : d.getTime();
  }

  function formatTwoDigits(num) {
    return num < 10 ? "0" + Math.max(0, num) : String(Math.max(0, num));
  }

  function updateCountdown() {
    const targetTime = getTargetTime();
    const now = new Date().getTime();
    const distance = targetTime - now;

    if (distance <= 0) {
      daysEl.textContent = "00";
      hoursEl.textContent = "00";
      minutesEl.textContent = "00";
      secondsEl.textContent = "00";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = formatTwoDigits(days);
    hoursEl.textContent = formatTwoDigits(hours);
    minutesEl.textContent = formatTwoDigits(minutes);
    secondsEl.textContent = formatTwoDigits(seconds);
  }

  window.__wwUpdateCountdown = updateCountdown;
  updateCountdown();
  setInterval(updateCountdown, 1000);
});
