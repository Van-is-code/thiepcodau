/**
 * ============================================================
 * EDITORIAL GALLERY & LIGHTBOX — BLUE BOTANICAL WEDDING
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const lightbox = document.getElementById("gallery-lightbox");
  const lightboxImg = document.getElementById("lightbox-photo");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const closeBtn = document.getElementById("lightbox-close");

  if (!lightbox || !lightboxImg) return;

  function openLightbox(src, caption) {
    lightboxImg.src = src;
    if (lightboxCaption) {
      lightboxCaption.textContent = caption || "";
    }
    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Bind click on gallery items
  document.querySelectorAll("[data-lightbox-src]").forEach((item) => {
    item.addEventListener("click", () => {
      const src = item.getAttribute("data-lightbox-src");
      const caption = item.getAttribute("data-caption");
      openLightbox(src, caption);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeLightbox);
  }

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
});

