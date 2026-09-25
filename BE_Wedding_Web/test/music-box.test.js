'use strict';
// Hộp nhạc: mẫu thiệp có thẻ <audio> thì mới phát được nhạc nền.
// Mẫu tối giản không có -> không hiện ô chọn nhạc cho khách.
const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const { convertThemeZip } = require('../src/services/themeConverter/packager');

const goiTheme = (html, tep = {}) => {
  const zip = new AdmZip();
  zip.addFile('index.html', Buffer.from(html, 'utf8'));
  for (const [ten, noi] of Object.entries(tep)) zip.addFile(ten, Buffer.from(noi, 'utf8'));
  return zip.toBuffer();
};

test('theme CÓ thẻ audio -> has_music_box = true', () => {
  const r = convertThemeZip(goiTheme(
    '<html><body><h1>Thiệp</h1><audio src="nhac.mp3"></audio></body></html>'
  ), { dryRun: true });
  assert.equal(r.manifest.has_music_box, true);
  assert.equal(r.manifest.audio_count, 1);
});

test('theme KHÔNG có thẻ audio -> has_music_box = false', () => {
  const r = convertThemeZip(goiTheme(
    '<html><body><h1>Thiệp</h1><p>Không có nhạc</p></body></html>'
  ), { dryRun: true });
  assert.equal(r.manifest.has_music_box, false);
  assert.equal(r.manifest.audio_count, 0);
});

test('thẻ audio đánh dấu data-skip-auto-music KHÔNG tính là hộp nhạc', () => {
  // Theme tự quản lý nhạc theo cách riêng thì hệ thống đừng chen vào.
  const r = convertThemeZip(goiTheme(
    '<html><body><audio data-skip-auto-music src="x.mp3"></audio></body></html>'
  ), { dryRun: true });
  assert.equal(r.manifest.has_music_box, false);
});

test('nhiều thẻ audio vẫn đếm đủ', () => {
  const r = convertThemeZip(goiTheme(
    '<html><body><audio src="a.mp3"></audio><audio src="b.mp3"></audio></body></html>'
  ), { dryRun: true });
  assert.equal(r.manifest.has_music_box, true);
  assert.equal(r.manifest.audio_count, 2);
});
