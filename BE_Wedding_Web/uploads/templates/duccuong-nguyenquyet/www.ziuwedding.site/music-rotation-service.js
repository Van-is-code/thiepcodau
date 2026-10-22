document.addEventListener("DOMContentLoaded", function () {
  const audio = document.getElementById("background-music");
  const btn = document.getElementById("toggle-music");
  const sourceEl = audio ? audio.querySelector("source") : null;
  if (!audio || !btn || !sourceEl) return;

  window.__musicRotationServiceActive = true;

  // Bat buoc set window.MUSIC_PLAYLIST = ["link1", "link2", ...] trong HTML.
  const fromWindow = Array.isArray(window.MUSIC_PLAYLIST) ? window.MUSIC_PLAYLIST : [];
  const MUSIC_PLAYLIST = fromWindow
    .map(function (item) { return String(item || "").trim(); })
    .filter(Boolean);
  if (MUSIC_PLAYLIST.length === 0) {
    console.warn("MUSIC_PLAYLIST is empty. Please configure at least 1 track in HTML.");
    return;
  }
  const DEFAULT_SWITCH_MINUTES = 30;
  const configuredSwitchMinutes = Number(window.MUSIC_SWITCH_MINUTES);
  const switchMinutes = Number.isFinite(configuredSwitchMinutes) && configuredSwitchMinutes > 0
    ? configuredSwitchMinutes
    : DEFAULT_SWITCH_MINUTES;
  const TRACK_SWITCH_INTERVAL_MS = switchMinutes * 60 * 1000;
  let currentTrackIndex = -1;

  audio.volume = 0.8;

  function syncDisc(playing) {
    var discs = document.querySelectorAll('#IMAGE39 .ladi-image, #IMAGE39 .ladi-image-background, .music-disc-icon');
    for (var i = 0; i < discs.length; i++) {
      if (playing) discs[i].classList.add('ww-rotating');
      else discs[i].classList.remove('ww-rotating');
    }
  }

  function startRotate() {
    btn.style.animation = "rotate 2s linear infinite";
    btn.textContent = "🔊";
    syncDisc(true);
  }

  function stopRotate() {
    btn.style.animation = "none";
    btn.textContent = "🔇";
    syncDisc(false);
  }

  audio.addEventListener("play", startRotate);
  audio.addEventListener("pause", stopRotate);

  function pickRandomTrackIndex(excludeIndex) {
    if (MUSIC_PLAYLIST.length <= 1) return 0;
    let nextIndex = excludeIndex;
    while (nextIndex === excludeIndex) {
      nextIndex = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
    }
    return nextIndex;
  }

  function setTrack(index) {
    if (!MUSIC_PLAYLIST[index]) return;
    const wasPlaying = !audio.paused;
    currentTrackIndex = index;
    sourceEl.src = MUSIC_PLAYLIST[index];
    audio.load();

    if (wasPlaying && !window.__wwUserPaused) {
      audio.play().then(startRotate).catch(stopRotate);
    }
  }

  function randomAndSwitchTrack() {
    const nextIndex = pickRandomTrackIndex(currentTrackIndex);
    setTrack(nextIndex);
  }

  // Chon bai random dau tien khi tai trang.
  randomAndSwitchTrack();

  // Cu switchMinutes phut doi sang 1 bai random khac va lap lai.
  setInterval(randomAndSwitchTrack, TRACK_SWITCH_INTERVAL_MS);

  function toggleMusic(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    if (audio.paused) {
      window.__wwUserPaused = false;
      audio.play().then(startRotate).catch(function () {});
    } else {
      window.__wwUserPaused = true;
      audio.pause();
      stopRotate();
    }
  }

  btn.__wwControlled = true;
  btn.addEventListener("click", toggleMusic);

  const btn4 = document.getElementById("BUTTON4");
  if (btn4) {
    btn4.__wwControlled = true;
    btn4.style.cursor = "pointer";
    btn4.addEventListener("click", toggleMusic);
  }

  // Co gang autoplay sau tuong tac dau tien cua user (neu chua bi nguoi dung chu dong tat)
  function tryPlay(e) {
    if (window.__wwUserPaused) return;
    if (e && e.target && e.target.closest && (e.target.closest('#toggle-music') || e.target.closest('#BUTTON4') || e.target.closest('#GROUP43'))) {
      return;
    }
    if (audio.paused) {
      audio.play().then(startRotate).catch(function () {});
    }
  }

  window.addEventListener("scroll", tryPlay, { once: true });
  document.addEventListener("click", tryPlay, { once: true });
  document.addEventListener("touchstart", tryPlay, { once: true });
});
