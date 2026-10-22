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

  // Retrieve event time from weddingData if available, fallback to default
  const targetDateStr = (window.weddingData && window.weddingData.eventTime && window.weddingData.eventTime.isoDateTime)
    ? window.weddingData.eventTime.isoDateTime
    : "2025-04-26T11:00:00+07:00";

  const targetTime = new Date(targetDateStr).getTime();

  function formatTwoDigits(num) {
    return num < 10 ? "0" + Math.max(0, num) : String(Math.max(0, num));
  }

  function updateCountdown() {
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

  updateCountdown();
  setInterval(updateCountdown, 1000);
});

