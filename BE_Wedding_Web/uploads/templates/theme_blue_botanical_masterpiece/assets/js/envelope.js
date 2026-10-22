/**
 * ============================================================
 * ENVELOPE INTERACTION & 3D OPENING CONTROLLER — BLUE BOTANICAL
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const envelopeStage = document.getElementById("envelope-stage");
  const envelopeContainer = document.getElementById("envelope-container");
  const waxSeal = document.getElementById("wax-seal");
  const carrierRig = document.getElementById("carrier-rig");

  if (!envelopeStage || !envelopeContainer) return;

  let isOpened = false;

  // Function to trigger cinematic opening sequence
  function openEnvelope() {
    if (isOpened) return;
    isOpened = true;

    // Fast-hide carrier rig if still mid-flight
    if (carrierRig) {
      carrierRig.style.transition = "opacity 0.3s ease";
      carrierRig.style.opacity = "0";
      carrierRig.style.pointerEvents = "none";
    }

    // Step 1: Flap flips open in 3D, butterfly takes flight, and top content fades out
    envelopeContainer.classList.add("opening");
    envelopeStage.classList.add("opening-stage");
    document.dispatchEvent(new CustomEvent("envelopeOpened"));

    // Optional audio playback trigger on first physical interaction
    if (window.WeddingMusic && typeof window.WeddingMusic.startOnOpen === "function") {
      window.WeddingMusic.startOnOpen();
    }

    // Step 2: Inner card has slid up smoothly (480ms to 1200ms).
    // At 1450ms, begin the silky cross-dissolve into Main Wedding Stationery
    setTimeout(() => {
      envelopeStage.classList.add("expanding");
    }, 1450);

    // Step 3: Complete transition to Main Wedding Stationery (2300ms)
    setTimeout(() => {
      envelopeStage.classList.add("stage-hidden");
      // Scroll to top of main invitation smoothly
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 2300);
  }

  // Bind click & touch to envelope container and wax seal
  envelopeContainer.addEventListener("click", openEnvelope);
  if (waxSeal) {
    waxSeal.addEventListener("click", (e) => {
      e.stopPropagation();
      openEnvelope();
    });
  }

  // Keyboard accessibility (Enter or Space to open)
  envelopeContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openEnvelope();
    }
  });
});

