document.addEventListener("DOMContentLoaded", function () {
  const audio = document.getElementById("background-music");
  const btn = document.getElementById("toggle-music");
  const sourceEl = audio ? audio.querySelector("source") : null;
  if (!audio || !btn || !sourceEl) return;

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

  function startRotate() {
    btn.style.animation = "rotate 2s linear infinite";
  }

  function stopRotate() {
    btn.style.animation = "none";
  }

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

    if (wasPlaying) {
      audio.play().then(function () {
        btn.textContent = "🔊";
        startRotate();
      }).catch(function () {
        btn.textContent = "🔇";
        stopRotate();
      });
    }
  }

  function randomAndSwitchTrack() {
    const nextIndex = pickRandomTrackIndex(currentTrackIndex);
    setTrack(nextIndex);
  }

  // Chon bai random dau tien khi tai trang.
  randomAndSwitchTrack();

  // Cu 30 phut doi sang 1 bai random khac va lap lai.
  setInterval(randomAndSwitchTrack, TRACK_SWITCH_INTERVAL_MS);

  // Toggle phat/tam dung nhac.
  btn.addEventListener("click", function () {
    if (audio.paused) {
      audio.play().then(function () {
        btn.textContent = "🔊";
        startRotate();
      }).catch(function () {
        // Bi chan autoplay tren mot so trinh duyet.
      });
    } else {
      audio.pause();
      btn.textContent = "🔇";
      stopRotate();
    }
  });

  // Co gang autoplay sau tuong tac dau tien cua user.
  function tryPlay() {
    if (audio.paused) {
      audio.play().then(function () {
        btn.textContent = "🔊";
        startRotate();
      }).catch(function () {
        // Bi chan autoplay thi bo qua.
      });
    }
  }

  window.addEventListener("scroll", tryPlay, { once: true });
  document.addEventListener("click", tryPlay, { once: true });
  document.addEventListener("touchstart", tryPlay, { once: true });
});
