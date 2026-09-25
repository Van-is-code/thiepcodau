// So sánh MÃ NGUỒN theme gốc với theme đã chuyển: chứng minh bộ chuyển đổi chỉ
// THÊM thuộc tính data-*, không xoá hay sửa gì của theme.
//
//   node tools/source-diff.cjs <gốc>/index.html <đã-chuyển>/index.html
//   node tools/source-diff.cjs <thư-mục-gốc> <thư-mục-đã-chuyển>
//
// Đưa vào hai THƯ MỤC thì so luôn cả assets bằng mã băm — đổi một byte trong ảnh
// hay CSS cũng lộ ra.
const fs = require('fs');
const cheerio = require('cheerio');
const crypto = require('crypto');
const path = require('path');
const [, , dauA, dauB] = process.argv;
if (!dauA || !dauB) {
  console.error('Thiếu tham số. Xem phần hướng dẫn ở đầu tệp này.');
  process.exit(2);
}

const laThuMuc = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();

// Duyệt hết tệp trong thư mục, trả về { đường-dẫn-tương-đối: mã băm }.
const bamThuMuc = (goc, boQua) => {
  const out = {};
  const di = (abs, rel) => {
    for (const ten of fs.readdirSync(abs)) {
      const day = path.join(abs, ten);
      const duong = rel ? rel + '/' + ten : ten;
      if (fs.statSync(day).isDirectory()) { di(day, duong); continue; }
      if (boQua.has(duong)) continue;
      out[duong] = crypto.createHash('md5').update(fs.readFileSync(day)).digest('hex');
    }
  };
  di(goc, '');
  return out;
};

// So assets của hai thư mục (trừ tệp HTML vào cổng, đã so riêng ở dưới).
const soAsset = (thuMucA, thuMucB, boQua) => {
  const a = bamThuMuc(thuMucA, boQua);
  const b = bamThuMuc(thuMucB, boQua);
  const tenA = Object.keys(a).sort();
  const tenB = Object.keys(b).sort();
  const thieu = tenA.filter((t) => !(t in b));
  const thua = tenB.filter((t) => !(t in a));
  const khac = tenA.filter((t) => t in b && a[t] !== b[t]);
  console.log('--- assets:', tenA.length, 'tệp gốc vs', tenB.length, 'tệp mới');
  for (const t of thieu.slice(0, 10)) console.log('    !! MẤT tệp:', t);
  for (const t of thua.slice(0, 10)) console.log('    !! THỪA tệp:', t);
  for (const t of khac.slice(0, 10)) console.log('    !! ĐỔI nội dung:', t);
  const sach = !thieu.length && !thua.length && !khac.length;
  console.log('    ' + (sach ? 'tất cả assets giống hệt' : 'CÓ KHÁC BIỆT ở assets'));
  return sach;
};

// Tìm tệp HTML vào cổng trong một thư mục theme.
const timVaoCong = (thuMuc) => {
  const uu = ['index.html'];
  for (const t of uu) if (fs.existsSync(path.join(thuMuc, t))) return t;
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    const abs = path.join(thuMuc, rel);
    for (const ten of fs.readdirSync(abs)) {
      const duong = rel ? rel + '/' + ten : ten;
      if (fs.statSync(path.join(abs, ten)).isDirectory()) { stack.push(duong); continue; }
      if (/\.html?$/i.test(ten)) return duong;
    }
  }
  return null;
};

let fileA = dauA;
let fileB = dauB;
let assetOk = true;
if (laThuMuc(dauA) && laThuMuc(dauB)) {
  const vaoA = timVaoCong(dauA);
  const vaoB = timVaoCong(dauB);
  if (!vaoA || !vaoB) { console.error('Không tìm thấy tệp HTML vào cổng trong thư mục.'); process.exit(2); }
  if (vaoA !== vaoB) console.log('!! tên tệp vào cổng khác nhau:', vaoA, 'vs', vaoB);
  fileA = path.join(dauA, vaoA);
  fileB = path.join(dauB, vaoB);
  assetOk = soAsset(dauA, dauB, new Set([vaoA, vaoB]));
}

const A = fs.readFileSync(fileA, 'utf8'), B = fs.readFileSync(fileB, 'utf8');
const $a = cheerio.load(A), $b = cheerio.load(B);
const ea = $a('*').toArray(), eb = $b('*').toArray();
console.log('byte gốc', A.length, '-> byte mới', B.length, '| số thẻ', ea.length, 'vs', eb.length);
if (ea.length !== eb.length) { console.log('!! SỐ THẺ KHÁC NHAU'); process.exit(1); }
let khac = 0; const them = {}; const doi = [];
for (let i = 0; i < ea.length; i++) {
  const a = ea[i], b = eb[i];
  if (a.tagName !== b.tagName) { console.log('!! thẻ khác', i, a.tagName, b.tagName); khac++; continue; }
  const aa = a.attribs || {}, bb = b.attribs || {};
  for (const k of Object.keys(aa)) {
    if (!(k in bb)) { console.log('!! MẤT thuộc tính', a.tagName, k); khac++; }
    else if (aa[k] !== bb[k]) { doi.push([a.tagName, k, String(aa[k]).slice(0, 50), String(bb[k]).slice(0, 50)]); khac++; }
  }
  for (const k of Object.keys(bb)) if (!(k in aa)) them[k] = (them[k] || 0) + 1;
}
console.log('--- thuộc tính MỚI THÊM:');
for (const [k, v] of Object.entries(them).sort((x, y) => y[1] - x[1])) console.log('   ', k, v, /^data-/.test(k) ? '' : '<<< KHÔNG PHẢI data-*');
console.log('--- giá trị thuộc tính BỊ ĐỔI:', doi.length);
doi.slice(0, 20).forEach((r) => console.log('   ', r.join(' | ')));
const ta = $a('body').text().replace(/\s+/g, ' ').trim(), tb = $b('body').text().replace(/\s+/g, ' ').trim();
console.log('--- chữ hiện trên trang giống hệt:', ta === tb, '(', ta.length, 'vs', tb.length, ')');
const sa = $a('style').toArray().map((e) => $a(e).html()).join('|'), sb = $b('style').toArray().map((e) => $b(e).html()).join('|');
console.log('--- CSS trong trang giống hệt:', sa === sb, '(', sa.length, 'vs', sb.length, ')');
const ja = $a('script').toArray().map((e) => $a(e).html()).join('|'), jb = $b('script').toArray().map((e) => $b(e).html()).join('|');
console.log('--- JS trong trang giống hệt:', ja === jb, '(', ja.length, 'vs', jb.length, ')');
const sach = assetOk && khac === 0 && ta === tb && sa === sb && ja === jb
  && Object.keys(them).every((k) => /^data-/.test(k));
console.log(sach
  ? '=== CHỈ THÊM THUỘC TÍNH data-*, THEME GIỮ NGUYÊN 100% ==='
  : '=== CÓ KHÁC BIỆT NGOÀI data-* — xem ở trên ===');
process.exitCode = sach ? 0 : 1;
