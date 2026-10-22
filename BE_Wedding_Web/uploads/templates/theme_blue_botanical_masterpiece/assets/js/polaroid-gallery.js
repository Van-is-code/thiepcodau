/**
 * ============================================================
 * INTERACTIVE POLAROID GALLERY CONTROLLER
 * Seamless Infinite Recycle Loop & Photo Counter
 * ============================================================
 */

(function () {
  'use strict';

  function initPolaroidGallery() {
    const stage = document.querySelector('.polaroid-stack-stage');
    if (!stage) return;

    let cards = Array.from(stage.querySelectorAll('.polaroid-item'));
    const totalCards = cards.length;
    const btnNext = document.getElementById('polaroid-btn-next');
    const btnFan = document.getElementById('polaroid-btn-fan');
    const btnReset = document.getElementById('polaroid-btn-reset');
    const hintCue = document.querySelector('.polaroid-hint-cue');
    const counterDisplay = document.getElementById('polaroid-counter');

    let isFanned = false;
    let isAnimating = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let activeCard = null;

    function getTopCard() {
      // First card in stage that is not currently animating out
      return stage.querySelector('.polaroid-item:not(.is-dismissing)');
    }

    function updateCounter() {
      if (!counterDisplay) return;
      const top = getTopCard();
      if (top) {
        const originalIndex = parseInt(top.getAttribute('data-index') || '0', 10);
        counterDisplay.textContent = `Ảnh ${originalIndex + 1} / ${totalCards}`;
      }
    }

    function updateHint() {
      if (!hintCue) return;
      if (isFanned) {
        hintCue.textContent = 'Đang ở chế độ xòe album ảnh';
      } else {
        hintCue.textContent = 'Vuốt hoặc chạm vào ảnh để xem tiếp';
      }
    }

    function dismissCard(card, direction) {
      if (!card || isAnimating) return;
      if (isFanned) {
        stage.classList.remove('fan-out');
        isFanned = false;
      }

      isAnimating = true;
      card.classList.add('is-dismissing');
      card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease';

      if (direction === 'left') {
        card.classList.add('dismissed-left');
      } else {
        card.classList.add('dismissed-right');
      }

      // After toss animation: recycle card to bottom of the stack seamlessly (never blank!)
      setTimeout(() => {
        card.style.transition = 'none';
        card.classList.remove('dismissed-left', 'dismissed-right', 'is-dismissing');
        card.style.transform = '';
        
        // Append to the end of stage -> becomes bottom card of stack
        stage.appendChild(card);

        // Force repaint then re-enable transition
        void card.offsetHeight;
        card.style.transition = '';

        isAnimating = false;
        updateCounter();
        updateHint();
      }, 400);

      // Immediately update counter for next visible top card
      setTimeout(updateCounter, 50);
    }

    function resetGallery() {
      if (isAnimating) return;
      stage.classList.remove('fan-out');
      isFanned = false;

      // Re-sort cards by data-index
      const sortedCards = Array.from(stage.querySelectorAll('.polaroid-item')).sort((a, b) => {
        return parseInt(a.getAttribute('data-index') || '0', 10) - parseInt(b.getAttribute('data-index') || '0', 10);
      });

      sortedCards.forEach(card => {
        card.style.transition = 'none';
        card.classList.remove('dismissed-left', 'dismissed-right', 'is-dismissing');
        card.style.transform = '';
        stage.appendChild(card);
      });

      setTimeout(() => {
        sortedCards.forEach(c => c.style.transition = '');
        updateCounter();
        updateHint();
      }, 50);
    }

    function toggleFanOut() {
      if (isAnimating) return;
      isFanned = !isFanned;
      if (isFanned) {
        stage.classList.add('fan-out');
      } else {
        stage.classList.remove('fan-out');
      }
      updateHint();
    }

    // Button actions
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const top = getTopCard();
        if (top) {
          dismissCard(top, Math.random() > 0.5 ? 'right' : 'left');
        }
      });
    }

    if (btnFan) {
      btnFan.addEventListener('click', toggleFanOut);
    }

    if (btnReset) {
      btnReset.addEventListener('click', resetGallery);
    }

    // Touch & Mouse Drag / Swipe Handlers
    function onStart(e) {
      if (isFanned || isAnimating) return;
      const top = getTopCard();
      if (!top) return;

      activeCard = top;
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      currentX = clientX;
      currentY = clientY;

      activeCard.style.transition = 'none';
    }

    function onMove(e) {
      if (!isDragging || !activeCard) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      currentX = clientX;
      currentY = clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const rot = deltaX * 0.08;

      activeCard.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rot}deg)`;
    }

    function onEnd() {
      if (!isDragging || !activeCard) return;
      isDragging = false;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > 50 || Math.abs(deltaX) > 40) {
        // Toss card
        const dir = deltaX >= 0 ? 'right' : 'left';
        dismissCard(activeCard, dir);
      } else {
        // Snap back
        activeCard.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        activeCard.style.transform = '';
      }
      activeCard = null;
    }

    // Click on stage to toss
    stage.addEventListener('click', (e) => {
      if (isFanned) {
        toggleFanOut();
        return;
      }
      const top = getTopCard();
      const delta = Math.hypot(currentX - startX, currentY - startY);
      if (top && delta < 8 && !isAnimating) {
        dismissCard(top, Math.random() > 0.5 ? 'right' : 'left');
      }
    });

    stage.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    stage.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);

    updateCounter();
    updateHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPolaroidGallery);
  } else {
    initPolaroidGallery();
  }
})();
