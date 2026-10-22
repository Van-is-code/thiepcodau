/**
 * ============================================================
 * MUSIC CONTROLLER — BLUE BOTANICAL WEDDING
 * Supports Independent Background Music with Audio Ducking
 * ============================================================
 */

(function () {
  let audioElement = null;
  let isPlaying = false;
  const normalVolume = 0.35;
  const duckedVolume = 0.08;
  let isDucked = false;
  let fadeInterval = null;
  const musicToggleBtn = document.getElementById("music-toggle-btn");

  function initAudio() {
    if (audioElement) return;

    audioElement = new Audio();
    const audioSrc = (window.weddingData && window.weddingData.music && window.weddingData.music.src)
      ? window.weddingData.music.src
      : "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=romantic-wedding-113886.mp3";

    audioElement.src = audioSrc;
    audioElement.loop = true;
    audioElement.volume = isDucked ? duckedVolume : normalVolume;
  }

  function fadeToVolume(target, duration = 700) {
    if (!audioElement) return;
    clearInterval(fadeInterval);
    const stepTime = 40;
    const steps = duration / stepTime;
    const stepDelta = (target - audioElement.volume) / steps;

    fadeInterval = setInterval(() => {
      let nextVol = audioElement.volume + stepDelta;
      if ((stepDelta > 0 && nextVol >= target) || (stepDelta < 0 && nextVol <= target)) {
        audioElement.volume = target;
        clearInterval(fadeInterval);
      } else {
        audioElement.volume = Math.max(0, Math.min(1, nextVol));
      }
    }, stepTime);
  }

  function duckVolume() {
    isDucked = true;
    if (audioElement && isPlaying) {
      fadeToVolume(duckedVolume, 800);
    }
  }

  function restoreVolume() {
    isDucked = false;
    if (audioElement && isPlaying) {
      fadeToVolume(normalVolume, 800);
    }
  }

  function playMusic() {
    initAudio();
    if (!audioElement) return;

    audioElement.volume = isDucked ? duckedVolume : normalVolume;
    audioElement.play().then(() => {
      isPlaying = true;
      if (musicToggleBtn) {
        musicToggleBtn.classList.add("playing");
        musicToggleBtn.setAttribute("aria-label", "Tắt nhạc nền");
      }
      document.dispatchEvent(new CustomEvent("weddingMusicPlay"));
    }).catch(() => {
      isPlaying = false;
      if (musicToggleBtn) {
        musicToggleBtn.classList.remove("playing");
        musicToggleBtn.setAttribute("aria-label", "Bật nhạc nền");
      }
      document.dispatchEvent(new CustomEvent("weddingMusicPause"));
    });
  }

  function pauseMusic() {
    if (audioElement) {
      audioElement.pause();
    }
    isPlaying = false;
    if (musicToggleBtn) {
      musicToggleBtn.classList.remove("playing");
      musicToggleBtn.setAttribute("aria-label", "Bật nhạc nền");
    }
    document.dispatchEvent(new CustomEvent("weddingMusicPause"));
  }

  function toggleMusic() {
    if (isPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  }

  // Bind floating toggle button
  if (musicToggleBtn) {
    musicToggleBtn.addEventListener("click", toggleMusic);
  }

  // Export for envelope interaction, turntable sync and audio ducking
  window.WeddingMusic = {
    isPlaying: function () {
      return isPlaying;
    },
    play: playMusic,
    pause: pauseMusic,
    toggle: toggleMusic,
    startOnOpen: function () {
      if (!isPlaying) {
        playMusic();
      }
    },
    duckVolume: duckVolume,
    restoreVolume: restoreVolume
  };
})();
