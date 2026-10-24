/**
 * Wedding Letter Intro — Two Doves Deliver the Wedding Letter
 * Visual Source of Truth: 8-Panel Reference Storyboard (media_1789570012744.jpg)
 * 
 * High-Performance Motion Engine: GSAP 3.12.5 (60 FPS GPU-accelerated transforms)
 * Bulletproof UX: Immediate response to clicks at any time, zero delay lockout
 */

(function () {
  'use strict';

  var state = {
    deliveryState: 'INTRO_IDLE', // INTRO_IDLE -> DOVES_ARRIVING -> DOVES_FLYING -> LETTER_RELEASED -> LETTER_ARRIVED -> READY_TO_OPEN -> LETTER_OPENING -> INVITATION_REVEALED
    recipientName: 'Quý Khách',
    timeline: null
  };

  // Run immediately if DOM is already ready, otherwise on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLetterIntro);
  } else {
    initLetterIntro();
  }

  function initLetterIntro() {
    var introEl = document.getElementById('wedding-letter-intro');
    if (!introEl) return;

    var envelopeWrapper = document.getElementById('wedding-envelope-wrapper');
    var physicalEnvelope = document.getElementById('wedding-envelope');
    var envelopeTopFlap = document.getElementById('envelope-top-flap');
    var enclosedCard = document.getElementById('envelope-letter-paper');
    var promptCue = document.getElementById('intro-prompt-cue');
    var recipientEl = document.getElementById('envelope-recipient-name');
    var recipientBox = document.getElementById('envelope-recipient-box');
    var carrierRig = document.getElementById('carrier-rig');
    var carriedEnvelope = document.getElementById('carried-envelope');
    var doveLeft = document.getElementById('dove-left');
    var doveRight = document.getElementById('dove-right');

    // 1. Check Skip / Query Params (?skip_intro=true or ?no_intro=true)
    var urlParams = new URLSearchParams(window.location.search);
    if (window.__weddingWebEditMode) {
      state.deliveryState = 'INVITATION_REVEALED';
      introEl.style.display = 'none';
      document.body.classList.remove('intro-active');
      return;
    }
    if (urlParams.has('skip_intro') || urlParams.has('no_intro')) {
      state.deliveryState = 'INVITATION_REVEALED';
      introEl.style.display = 'none';
      document.body.classList.remove('intro-active');
      return;
    }

    // 2. Parse Dynamic Recipient Name (?to=..., ?guest=..., ?name=..., ?khach=...)
    var dynamicName = urlParams.get('to') || urlParams.get('guest') || urlParams.get('name') || urlParams.get('khach') || (window.invitationData && (window.invitationData.guest_name || window.invitationData.guest));
    if (dynamicName && dynamicName.trim()) {
      state.recipientName = dynamicName.trim();
    }
    if (recipientEl) {
      recipientEl.textContent = state.recipientName;
      if (state.recipientName && state.recipientName.length > 20) {
        recipientEl.classList.add('is-long');
      } else {
        recipientEl.classList.remove('is-long');
      }
    }

    // Lock background scroll during intro
    document.body.classList.add('intro-active');

    // -------------------------------------------------------------------------
    // CRITICAL UX: REGISTER CLICK & TOUCH LISTENERS IMMEDIATELY UNCONDITIONALLY
    // -------------------------------------------------------------------------
    function onUserTap(e) {
      if (e) e.stopPropagation();
      handleOpenLetter();
    }

    if (physicalEnvelope) {
      physicalEnvelope.addEventListener('click', onUserTap);
      physicalEnvelope.addEventListener('touchend', onUserTap);
      physicalEnvelope.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          handleOpenLetter();
        }
      });
    }

    if (promptCue) {
      promptCue.addEventListener('click', onUserTap);
      promptCue.addEventListener('touchend', onUserTap);
    }

    // Also allow tapping anywhere on canvas to open
    introEl.addEventListener('click', onUserTap);
    introEl.addEventListener('touchend', onUserTap);

    // -------------------------------------------------------------------------
    // Fallback if GSAP is not loaded
    // -------------------------------------------------------------------------
    if (typeof gsap === 'undefined') {
      setupDirectSettledState();
      return;
    }

    // -------------------------------------------------------------------------
    // GSAP 3.12.5 Master Timeline Setup
    // -------------------------------------------------------------------------
    var introTl = gsap.timeline({
      defaults: { ease: "power2.out" }
    });
    state.timeline = introTl;

    // Set Initial GPU Coordinates
    gsap.set(carrierRig, {
      x: -180,
      y: -150,
      rotation: -12,
      scale: 0.75,
      opacity: 0,
      force3D: true
    });
    gsap.set(envelopeWrapper, {
      x: 10,
      y: -160,
      rotation: 12,
      scale: 0.75,
      opacity: 0,
      force3D: true
    });
    gsap.set(recipientBox, {
      opacity: 0,
      y: 10,
      force3D: true
    });
    gsap.set(promptCue, {
      opacity: 0,
      y: 10,
      force3D: true
    });

    // Scene 1 (0.0s – 0.5s): Canvas initialized
    introTl.add(function () {
      introEl.classList.add('is-loaded');
    }, 0.1);

    // Scene 2 (0.5s – 2.5s): Doves swoop in carrying envelope (natural wing flapping)
    introTl.add(function () {
      state.deliveryState = 'DOVES_ARRIVING';
      introEl.classList.add('is-arriving');
    }, 0.5);

    introTl.to(carrierRig, {
      duration: 2.0,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1.0,
      opacity: 1,
      ease: "power2.out"
    }, 0.5);

    // Scene 3 (2.5s – 3.6s): Doves hover flight across upper sky
    introTl.add(function () {
      state.deliveryState = 'DOVES_FLYING';
      introEl.classList.add('is-flying');
    }, 2.5);

    introTl.to(carrierRig, {
      duration: 1.1,
      x: 10,
      y: -6,
      rotation: 1.5,
      ease: "sine.inOut"
    }, 2.5);

    // Scene 4 (3.6s – 5.8s): THE RELEASE & DRIFT DESCENT
    introTl.add(function () {
      state.deliveryState = 'LETTER_RELEASED';
      introEl.classList.add('is-released');
    }, 3.6);

    // Carried envelope in rig disappears as physical envelope takes over
    introTl.to(carriedEnvelope, {
      duration: 0.08,
      opacity: 0,
      ease: "none"
    }, 3.6);

    // Doves soar away into the upper corners with upward lift
    introTl.to(doveLeft, {
      duration: 2.0,
      x: -280,
      y: -180,
      rotation: -30,
      scale: 0.22,
      opacity: 0,
      ease: "power2.in"
    }, 3.6);

    introTl.to(doveRight, {
      duration: 2.0,
      x: 280,
      y: -180,
      rotation: 30,
      scale: 0.22,
      opacity: 0,
      ease: "power2.in"
    }, 3.6);

    // Physical envelope drifts down slowly like a falling handmade paper letter
    introTl.set(envelopeWrapper, {
      opacity: 0.95,
      x: 10,
      y: -160,
      rotation: 12,
      scale: 0.75
    }, 3.6);

    introTl.to(envelopeWrapper, {
      duration: 0.6,
      x: -10,
      y: -100,
      rotation: -8,
      scale: 0.83,
      ease: "sine.inOut"
    }, 3.6);

    introTl.to(envelopeWrapper, {
      duration: 0.7,
      x: 8,
      y: -40,
      rotation: 5,
      scale: 0.92,
      ease: "sine.inOut"
    }, 4.2);

    introTl.to(envelopeWrapper, {
      duration: 0.5,
      x: -3,
      y: -10,
      rotation: -2,
      scale: 0.98,
      ease: "sine.inOut"
    }, 4.9);

    introTl.to(envelopeWrapper, {
      duration: 0.4,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1.0,
      opacity: 1.0,
      ease: "power1.out"
    }, 5.4);

    // Scene 5 (5.8s): Settled in Center
    introTl.add(function () {
      state.deliveryState = 'LETTER_ARRIVED';
      introEl.classList.add('is-arrived');
    }, 5.8);

    // Scene 6 (6.0s – 6.6s): Recipient plaque smoothly reveals
    introTl.to(recipientBox, {
      duration: 0.65,
      opacity: 1,
      y: 0,
      ease: "power2.out",
      onStart: function () {
        introEl.classList.add('is-recipient-visible');
      }
    }, 6.0);

    // Scene 7 (6.5s+): Prompt cue fades in & interaction ready
    introTl.to(promptCue, {
      duration: 0.5,
      opacity: 1,
      y: 0,
      ease: "power2.out",
      onStart: function () {
        state.deliveryState = 'READY_TO_OPEN';
        introEl.classList.add('is-ready-to-open');
      }
    }, 6.5);

    // -------------------------------------------------------------------------
    // Fallback Setup if GSAP not loaded
    // -------------------------------------------------------------------------
    function setupDirectSettledState() {
      state.deliveryState = 'READY_TO_OPEN';
      if (carrierRig) carrierRig.style.display = 'none';
      if (envelopeWrapper) {
        envelopeWrapper.style.opacity = '1';
        envelopeWrapper.style.transform = 'none';
      }
      if (recipientBox) {
        recipientBox.style.opacity = '1';
        recipientBox.style.transform = 'none';
      }
      if (promptCue) {
        promptCue.style.opacity = '1';
        promptCue.style.transform = 'none';
      }
      introEl.classList.add('is-loaded', 'is-arrived', 'is-recipient-visible', 'is-ready-to-open');
    }

    // -------------------------------------------------------------------------
    // Physical Opening Animation: "THE LETTER BECOMES THE INVITATION"
    // Can be triggered AT ANY TIME by user tap!
    // -------------------------------------------------------------------------
    function handleOpenLetter() {
      if (state.deliveryState === 'LETTER_OPENING' || state.deliveryState === 'INVITATION_REVEALED') {
        return;
      }
      state.deliveryState = 'LETTER_OPENING';

      // Fast-forward or stop the intro timeline
      if (introTl) {
        introTl.pause();
      }

      // Hide carrier rig immediately if still visible
      if (carrierRig) {
        if (typeof gsap !== 'undefined') {
          gsap.to(carrierRig, { duration: 0.25, opacity: 0, scale: 0.5 });
        } else {
          carrierRig.style.display = 'none';
        }
      }

      // Ensure envelope is centered and recipient plaque is visible
      if (envelopeWrapper) {
        if (typeof gsap !== 'undefined') {
          gsap.set(envelopeWrapper, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 });
        } else {
          envelopeWrapper.style.opacity = '1';
          envelopeWrapper.style.transform = 'none';
        }
      }
      if (recipientBox) {
        recipientBox.style.opacity = '1';
      }

      introEl.classList.add('is-loaded', 'is-arrived', 'is-recipient-visible', 'is-ready-to-open', 'is-opening');

      // Play background music on user touch gesture
      var bgAudio = document.getElementById('bg-audio');
      if (bgAudio) {
        try {
          var playPromise = bgAudio.play();
          if (playPromise !== undefined) {
            playPromise.then(function () {
              var musicBtn = document.getElementById('music-toggle');
              if (musicBtn) {
                musicBtn.classList.add('is-playing', 'playing');
                musicBtn.setAttribute('aria-pressed', 'true');
              }
            }).catch(function () {});
          }
        } catch (err) {}
      }

            // -----------------------------------------------------------------------
      // Physical Opening Animation: Sequential Timeline
      // Flap opens 100% first, then letter card smoothly rises up!
      // -----------------------------------------------------------------------
      if (typeof gsap !== 'undefined') {
        var openTl = gsap.timeline();

        // 1. Cue prompt fades out immediately & envelope lifts slightly
        openTl.to(promptCue, {
          duration: 0.15,
          opacity: 0,
          y: 8,
          ease: "power2.in"
        }, 0);

        openTl.to(physicalEnvelope, {
          duration: 0.35,
          y: -4,
          scale: 1.02,
          ease: "power2.out"
        }, 0);

        // 2. Wax seal fades out softly as flap begins to pull open
        var waxSeal = document.getElementById('envelope-wax-seal');
        if (recipientBox) {
          openTl.to(recipientBox, {
            duration: 0.25,
            opacity: 0,
            ease: "power1.in"
          }, 0.08);
        }

        if (waxSeal) {
          openTl.to(waxSeal, {
            duration: 0.25,
            opacity: 0,
            scale: 1.15,
            ease: "power1.in"
          }, 0.08);
        }

        // 3. Top flap folds OPEN in 3D (0.05s -> 0.65s)
        // FLAP OPENS FIRST COMPLETELY!
        openTl.to(envelopeTopFlap, {
          duration: 0.6,
          rotationX: -180,
          transformOrigin: "top center",
          ease: "power2.inOut",
          onUpdate: function () {
            var rot = gsap.getProperty(envelopeTopFlap, "rotationX");
            if (rot <= -85) {
              envelopeTopFlap.style.zIndex = "5";
            } else {
              envelopeTopFlap.style.zIndex = "12";
            }
          }
        }, 0.05);

        // 4. Enclosed stationery card slides UP from pocket ONLY AFTER flap has opened!
        // The card smoothly emerges at t = 0.65s!
        openTl.to(enclosedCard, {
          duration: 0.75,
          y: -125,
          ease: "power2.out",
          onStart: function () {
            enclosedCard.style.zIndex = "15";
          }
        }, 0.65);

        // 5. Card expands forward in front of the envelope and gains dramatic luxury depth
        openTl.to(enclosedCard, {
          duration: 0.45,
          scale: 1.12,
          zIndex: 25,
          boxShadow: "0 26px 65px rgba(50, 35, 70, 0.28)",
          ease: "power2.out"
        }, 1.3);

        // 6. Hold for guest to view the emerged card, then crossfade to main invitation
        var isStandalone = window.location.pathname.indexOf('intro.html') !== -1 || window.location.pathname.endsWith('/intro');

        if (isStandalone) {
          openTl.add(function () {
            var params = new URLSearchParams(window.location.search);
            params.set('skip_intro', 'true');
            window.location.href = 'index.html?' + params.toString();
          }, 2.3);
        } else {
          openTl.to(introEl, {
            duration: 0.7,
            opacity: 0,
            ease: "power2.inOut",
            onComplete: function () {
              state.deliveryState = 'INVITATION_REVEALED';
              introEl.classList.add('is-hidden');
              introEl.style.display = 'none';
              document.body.classList.remove('intro-active');
            }
          }, 2.1);
        }
      } else {
        // Fallback without GSAP
        envelopeTopFlap.style.transform = 'rotateX(-180deg)';
        envelopeTopFlap.style.zIndex = '1';
        setTimeout(function () {
          enclosedCard.style.transform = 'translateY(-125px) scale(1.12)';
          enclosedCard.style.zIndex = '25';
        }, 600);

        var isStandalone = window.location.pathname.indexOf('intro.html') !== -1 || window.location.pathname.endsWith('/intro');
        if (isStandalone) {
          setTimeout(function () {
            var params = new URLSearchParams(window.location.search);
            params.set('skip_intro', 'true');
            window.location.href = 'index.html?' + params.toString();
          }, 2200);
        } else {
          setTimeout(function () {
            state.deliveryState = 'INVITATION_REVEALED';
            introEl.classList.add('is-hidden');
            introEl.style.display = 'none';
            document.body.classList.remove('intro-active');
          }, 2200);
        }
      }
    }
  }

  // Expose state helper for inspection & testing
  window.WeddingLetterIntroState = state;
})();
