/**
 * ============================================================
 * IDEA 4: VINTAGE GRAMOPHONE CONTROLLER (BLUE BOTANICAL)
 * Independent Gramophone Audio Track + Background Music Ducking
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const gramophoneDeck = document.getElementById("gramophone-deck");
  const vinylDisc = document.getElementById("vinyl-disc");
  const tonearm = document.getElementById("tonearm-assembly");
  const gramophoneStatus = document.getElementById("gramophone-status");
  const statusText = document.getElementById("gramophone-status-text");
  const songTitleEl = document.getElementById("gramophone-song-title");
  const podcastBadgeEl = document.getElementById("gramophone-podcast-badge");
  const podcastVisualizer = document.getElementById("podcast-visualizer");
  const podcastTimer = document.getElementById("podcast-timer");

  let gramophoneAudio = null;
  let isGramophonePlaying = false;
  let tonearmTimer = null;

  // Retrieve configuration from weddingData
  const gData = (window.weddingData && window.weddingData.gramophoneAudio) || {
    title: "Lời Mời & Cảm Ơn Thân Mật",
    subtitle: "Minh Anh & Hoàng Nam gửi tới bạn",
    src: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=acoustic-guitar-wedding-10908.mp3",
    statusReady: "Chạm vào máy đĩa để nghe lời nhắn (Nhạc nền tự hạ nhỏ)",
    statusPlaying: "Đang phát lời nhắn của Dâu & Rể · Nhạc nền đã hạ nhỏ",
    badge: "✦ WEDDING PODCAST · LỜI TÂM TÌNH ✦",
    title: "Chuyện Chúng Mình & Lời Mời Cưới",
    subtitle: "Minh Anh & Hoàng Nam (00:46)",
    src: "assets/audio/wedding_podcast_voicenote.mp3",
    statusReady: "Chạm vào máy đĩa để nghe Podcast tâm tình (Nhạc nền tự hạ nhỏ)",
    statusPlaying: "Đang phát Voice Podcast của Dâu & Rể · Nhạc nền đã hạ nhỏ",
    statusPaused: "Tạm dừng · Chạm vào máy đĩa để nghe tiếp"
  };

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Set initial labels
  if (podcastBadgeEl && gData.badge) {
    const badgeText = podcastBadgeEl.querySelector(".podcast-badge-text");
    if (badgeText) {
      badgeText.textContent = gData.badge.replace(/^[✦✧\s]+|[✦✧\s]+$/g, '');
    }
  }
  if (songTitleEl && gData.title) {
    songTitleEl.textContent = `${gData.title} · ${gData.subtitle || ''}`;
  }
  if (statusText && gData.statusReady) {
    statusText.textContent = gData.statusReady;
  }

  function initGramophoneAudio() {
    if (gramophoneAudio) return;

    gramophoneAudio = new Audio();
    gramophoneAudio.src = gData.src;
    gramophoneAudio.volume = 0.9;
    gramophoneAudio.volume = 0.92;

    // Update real-time timer during playback
    gramophoneAudio.addEventListener("timeupdate", () => {
      if (podcastTimer && gramophoneAudio.duration) {
        const cur = formatTime(gramophoneAudio.currentTime);
        const dur = formatTime(gramophoneAudio.duration);
        podcastTimer.textContent = `${cur} / ${dur}`;
      }
    });

    gramophoneAudio.addEventListener("loadedmetadata", () => {
      if (podcastTimer && gramophoneAudio.duration) {
        const dur = formatTime(gramophoneAudio.duration);
        podcastTimer.textContent = `00:00 / ${dur}`;
      }
    });

    // When audio finishes playing: reset turntable and restore background music
    gramophoneAudio.addEventListener("ended", () => {
      stopGramophone();
      if (podcastTimer && gramophoneAudio.duration) {
        podcastTimer.textContent = `00:00 / ${formatTime(gramophoneAudio.duration)}`;
      }
      if (statusText) {
        statusText.textContent = "Đã phát xong · Chạm vào máy đĩa để nghe lại";
      }
    });

    gramophoneAudio.addEventListener("pause", () => {
      if (isGramophonePlaying) {
        stopGramophone();
      }
    });
  }

  function startGramophone() {
    initGramophoneAudio();
    isGramophonePlaying = true;

    // 1. Lower tonearm onto vinyl groove
    if (tonearm) tonearm.classList.add("active");
    if (gramophoneStatus) gramophoneStatus.classList.add("playing");
    if (statusText) statusText.textContent = gData.statusPlaying || "Đang phát lời nhắn · Nhạc nền đã hạ nhỏ";
    if (podcastVisualizer) podcastVisualizer.classList.add("playing");
    if (statusText) statusText.textContent = gData.statusPlaying || "Đang phát Voice Podcast · Nhạc nền đã hạ nhỏ";

    // 2. Needle lands and vinyl starts spinning smoothly
    clearTimeout(tonearmTimer);
    tonearmTimer = setTimeout(() => {
      if (vinylDisc && isGramophonePlaying) {
        vinylDisc.classList.add("spinning");
      }
    }, 280);

    // 3. Audio Ducking: Smoothly reduce background music volume to ambient level
    if (window.WeddingMusic && typeof window.WeddingMusic.duckVolume === "function") {
      window.WeddingMusic.duckVolume();
    }

    // 4. Play independent gramophone audio
    if (gramophoneAudio) {
      gramophoneAudio.play().catch((err) => {
        console.log("Gramophone audio play error or autoplay policy:", err);
        console.log("Gramophone podcast audio play error or autoplay policy:", err);
      });
    }
  }

  function stopGramophone() {
    isGramophonePlaying = false;
    clearTimeout(tonearmTimer);

    // 1. Lift tonearm and stop vinyl rotation
    if (vinylDisc) vinylDisc.classList.remove("spinning");
    if (tonearm) tonearm.classList.remove("active");
    if (gramophoneStatus) gramophoneStatus.classList.remove("playing");
    if (podcastVisualizer) podcastVisualizer.classList.remove("playing");
    if (statusText) statusText.textContent = gData.statusPaused || "Tạm dừng · Chạm vào máy đĩa để nghe tiếp";

    // 2. Pause independent gramophone audio
    if (gramophoneAudio && !gramophoneAudio.paused) {
      gramophoneAudio.pause();
    }

    // 3. Restore background music to normal full ambient volume
    if (window.WeddingMusic && typeof window.WeddingMusic.restoreVolume === "function") {
      window.WeddingMusic.restoreVolume();
    }
  }

  function toggleGramophone() {
    if (isGramophonePlaying) {
      stopGramophone();
    } else {
      startGramophone();
    }
  }

  // Bind click on entire gramophone deck or vinyl disc
  if (gramophoneDeck) {
    gramophoneDeck.addEventListener("click", (e) => {
      e.preventDefault();
      toggleGramophone();
    });
  }
});
