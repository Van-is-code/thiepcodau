/**
 * ============================================================
 * IDEA 3: LIVING BOTANICAL GARDEN ENGINE
 * Floating Hydrangea Petals, Golden Stardust, Roaming Butterflies
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Create Floating Petals Canvas
  const canvas = document.createElement("canvas");
  canvas.id = "garden-ambient-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Petal & Stardust particles
  const particles = [];
  const particleCount = window.innerWidth < 768 ? 22 : 45;

  // Hydrangea palette
  const colors = [
    "rgba(196, 217, 229, 0.75)", // powder blue
    "rgba(168, 195, 211, 0.65)", // dusty blue
    "rgba(217, 231, 237, 0.85)", // very light blue
    "rgba(245, 230, 163, 0.7)",  // golden stardust
    "rgba(255, 253, 248, 0.8)"   // ivory white
  ];

  class PetalParticle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : -20;
      this.size = Math.random() * 8 + 6;
      this.isStardust = Math.random() > 0.65;
      this.speedY = Math.random() * 0.9 + 0.5;
      this.speedX = Math.random() * 0.6 - 0.3;
      this.swaySpeed = Math.random() * 0.02 + 0.01;
      this.angle = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.03;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.opacity = Math.random() * 0.6 + 0.3;
    }

    update(windBonusX = 0) {
      this.y += this.speedY;
      this.x += Math.sin(this.angle) * 0.7 + this.speedX + windBonusX;
      this.angle += this.swaySpeed;

      if (this.y > height + 20 || this.x < -30 || this.x > width + 30) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;

      if (this.isStardust) {
        // Draw 4-point golden sparkle
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw delicate teardrop hydrangea petal
        ctx.beginPath();
        ctx.moveTo(0, -this.size * 0.6);
        ctx.quadraticCurveTo(this.size * 0.6, 0, 0, this.size * 0.8);
        ctx.quadraticCurveTo(-this.size * 0.6, 0, 0, -this.size * 0.6);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new PetalParticle());
  }

  let windBonus = 0;
  let lastScrollY = window.scrollY;

  window.addEventListener("scroll", () => {
    const delta = window.scrollY - lastScrollY;
    windBonus = Math.max(Math.min(delta * 0.05, 3), -3);
    lastScrollY = window.scrollY;
  }, { passive: true });

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Fade wind back to normal
    windBonus *= 0.95;

    particles.forEach(p => {
      p.update(windBonus);
      p.draw();
    });

    requestAnimationFrame(animate);
  }

  animate();

  // 2. Roaming Interactive Butterfly
  const butterflyEl = document.createElement("div");
  butterflyEl.className = "roaming-butterfly";
  butterflyEl.innerHTML = `<img src="assets/images/botanical/blue-butterfly.webp" alt="">`;
  document.body.appendChild(butterflyEl);

  let bfX = Math.random() * (width - 60) + 30;
  let bfY = Math.random() * (height - 60) + 30;
  let targetX = bfX;
  let targetY = bfY;

  function pickNewTarget() {
    targetX = Math.random() * (window.innerWidth - 80) + 40;
    targetY = Math.random() * (window.innerHeight - 80) + 40;
  }

  setInterval(pickNewTarget, 4500);

  // Click/Tap anywhere summons butterfly gently
  window.addEventListener("click", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  function updateButterfly() {
    const dx = targetX - bfX;
    const dy = targetY - bfY;
    bfX += dx * 0.035;
    bfY += dy * 0.035;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    butterflyEl.style.transform = `translate3d(${bfX}px, ${bfY}px, 0) rotate(${angle}deg)`;

    requestAnimationFrame(updateButterfly);
  }

  updateButterfly();
});

