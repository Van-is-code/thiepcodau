// Dựng tài liệu iframe cho 1 mẫu thiệp bằng chính hàm của hệ thống, ghi ra tệp HTML
// để mở bằng Chrome. Không cần backend/DB — kiểm đúng phần bơm dữ liệu vào mẫu.
//   node test/render-template.mjs <duong-dan-index.html> <tep-ra.html>
import { readFileSync, writeFileSync } from 'fs'

const [, , templatePath, outPath] = process.argv

// api.js đọc import.meta.env của Vite -> nạp trong Node sẽ lỗi. Nên nạp templateEngine
// qua một shim cung cấp API_BASE.
const engineSrc = readFileSync(new URL('../src/lib/templateEngine.js', import.meta.url), 'utf8')
  .replace("import { API_BASE } from '../api'", "const API_BASE = globalThis.__API_BASE__ || ''")
  .replace(
    "import { buildImageLoadingScript, preconnectOrigins, findLcpImage, DEFAULT_SIZES } from './imageLoading'",
    "const { buildImageLoadingScript, preconnectOrigins, findLcpImage, DEFAULT_SIZES } = globalThis.__IMG__"
  )

globalThis.__API_BASE__ = process.env.API_BASE || 'http://localhost:4180'
globalThis.__IMG__ = await import(new URL('../src/lib/imageLoading.js', import.meta.url).href)

const mod = await import('data:text/javascript;base64,' + Buffer.from(engineSrc).toString('base64'))


// Dung 1 ban ghi anh gia lap dung dinh dang BE tra ve. Anh la SVG mau dac ma hoa
// base64 -> khong can tep that, van kiem duoc srcset/lazy/blur hoat dong.
const solid = (hex, w, h) => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${hex}"/></svg>`
).toString('base64')

const img = (type, idx, hex, isCover = false) => {
  const widths = [400, 800, 1280, 1920]
  const mk = (fmt) => widths.map((w) => ({ width: w, height: Math.round(w * 4 / 3), bytes: w * 10, key: `k/${type}/${idx}/${fmt}/${w}`, url: solid(hex, w, Math.round(w * 4 / 3)) }))
  const variants = { avif: mk('avif'), webp: mk('webp'), jpeg: mk('jpeg') }
  const ss = (l) => l.map((v) => `${v.url} ${v.width}w`).join(', ')
  return {
    id: `${type}-${idx}`, image_type: type, sort_order: idx, is_cover: isCover,
    image_url: variants.jpeg[3].url, width: 1920, height: 2560,
    blur_data_url: solid(hex, 16, 21), dominant_color: hex,
    variants, srcset_avif: ss(variants.avif), srcset_webp: ss(variants.webp), srcset_jpeg: ss(variants.jpeg),
  }
}

// Dữ liệu thiệp thật, cố tình khác hẳn dữ liệu demo của mẫu để thấy rõ chỗ nào đã bind.
const invitation = {
  id: 'inv-test', invitation_slug: 'thu-nghiem',
  title_vi: 'Thiệp cưới Vân & Đức',
  template: { html_path: process.env.TPL_PATH || '/index.html' },
  ceremony_date: '2027-11-20T17:30:00.000Z',
  reception_date: '2027-11-21',
  ceremony_lunar_text: '(Nhằm ngày 23 tháng 10 năm Đinh Mùi)',
  reception_lunar_text: '(Nhằm ngày 24 tháng 10 năm Đinh Mùi)',
  venue_address: 'Số 7 Lê Hồng Phong, Ngô Quyền, Hải Phòng',
  map_url: 'https://maps.google.com/?q=Le+Hong+Phong+Hai+Phong',
  reception_venue_address: 'Trung tâm tiệc cưới Hoàng Gia, Hải An, Hải Phòng',
  reception_map_url: 'https://maps.google.com/?q=Hoang+Gia+Hai+An',
  thank_you_message: 'Cảm ơn quý khách đã dành thời gian cho ngày vui của chúng tôi.',
  music_url: '/media/music/demo.mp3',
  groom: {
    name_groom: 'Nguyễn Đức Anh', father_grom: 'Ông: Nguyễn Văn Hùng',
    mother_groom: 'Bà: Trần Thị Lan', address: 'Ngô Quyền · Hải Phòng',
    bank_name: 'Techcombank', bank_account_name: 'NGUYEN DUC ANH', bank_account_number: '19036666888',
  },
  bride: {
    name_bride: 'Phạm Thanh Vân', father_bride: 'Ông: Phạm Quốc Toản',
    mother_bride: 'Bà: Lê Thị Hoa', address: 'Hải An · Hải Phòng',
    bank_name: 'Vietcombank', bank_account_name: 'PHAM THANH VAN', bank_account_number: '0451000123456',
  },
  extra_data: {
    monogram: 'V & Đ',
    wedding_tag: 'LỄ THÀNH HÔN',
    envelope_subtext: 'Trân trọng kính mời tới dự lễ thành hôn',
    welcome_quote: '"Có bạn ở đó, ngày vui của chúng mình mới thật trọn vẹn."',
    welcome_text: 'Chúng mình xin trân trọng kính mời bạn tới chung vui trong ngày trọng đại.',
    family_lead_text: 'Trân trọng báo tin vui của hai con tới quý thân bằng quyến thuộc.',
    invitation_greeting: 'Trân trọng kính mời Quý khách',
    invitation_greeting_sub: 'tham dự bữa tiệc chung vui cùng gia đình chúng tôi',
    reception_venue_name: 'Trung tâm tiệc cưới Hoàng Gia · Sảnh Ngọc Trai',
    reception_time: '18:00',
    ceremony_intro: 'Tới dự lễ thành hôn của chúng tôi',
    venue_name: 'Tư gia nhà trai · Số 7 Lê Hồng Phong',
    ceremony_heartfelt_quote: '"Sự hiện diện của Quý khách là niềm vinh hạnh của hai gia đình!"',
    timeline_time_1: '16:00', timeline_title_1: 'Đón Khách', timeline_desc_1: 'Đón tiếp quan khách và chụp ảnh lưu niệm.',
    timeline_time_2: '17:30', timeline_title_2: 'Làm Lễ', timeline_desc_2: 'Nghi thức thành hôn và trao nhẫn cưới.',
    timeline_time_3: '18:00', timeline_title_3: 'Khai Tiệc', timeline_desc_3: 'Thưởng thức tiệc tối cùng gia đình hai bên.',
    timeline_time_4: '19:30', timeline_title_4: 'Chung Vui', timeline_desc_4: 'Giao lưu văn nghệ và chụp ảnh kỷ niệm.',
    story_quote: '"Gặp nhau giữa mùa hoa phượng Hải Phòng, và ở lại với nhau từ đó."',
    story_content: 'Chúng mình quen nhau từ thời sinh viên, cùng đi qua những mùa thi và những chuyến xe muộn.',
    footer_thank_you: 'Trân Trọng Cảm Ơn',
    vinyl_track_text: '✦ VÂN & ĐỨC · FOREVER IN LOVE · 20.11.2027 ✦',
    podcast_title: 'Lời mời từ Vân & Đức',
    groom_transfer_note: 'Mung cuoi Duc Anh',
    bride_transfer_note: 'Mung cuoi Thanh Van',
  },
  // Ảnh thật do chủ thiệp tải lên, đúng dạng invitationImageService.publicImage()
  // trả về (kèm nhiều cỡ để dựng srcset + ảnh nhoè).
  images: (process.env.WITH_IMAGES === '1' ? [
    img('cover', 0, '#c98a6a', true),
    img('groom', 0, '#6a89c9'),
    img('bride', 0, '#c96a9e'),
    img('story', 0, '#8ac96a'),
    img('gallery', 0, '#c9b86a'), img('gallery', 1, '#6ac9b8'),
    img('gallery', 2, '#9e6ac9'), img('gallery', 3, '#c96a6a'),
    img('gallery', 4, '#6a9ec9'),
    img('bank_qr', 0, '#333333'),
  ] : []),
}

const templateHtml = readFileSync(templatePath, 'utf8')
const out = mod.buildIframeDocument(templateHtml, invitation, { editMode: false })
writeFileSync(outPath, out)
console.log('da dung tai lieu iframe ->', outPath, '(' + out.length + ' ky tu)')
