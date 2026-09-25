/**
 * Seed 1 invitation demo dùng mẫu "duccuong-nguyenquyet" để test end-to-end:
 * đăng ký template (nếu chưa có) + tạo user/groom/bride/invitation/ảnh mẫu với
 * TÊN KHÁC couple gốc trong template — để chứng minh mọi field thật sự lấy từ DB,
 * không còn hardcode "Đức Cương & Nguyễn Quyết" nữa.
 *
 * Chạy trong container: node scripts/seed-demo-invitation.js
 */
const { randomUUID } = require('crypto');
const { sequelize, User, InvitationTemplate, Groom, Bride, Invitation, InvitationImage } = require('../src/models');

const BASE_URL = process.env.SEED_BASE_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.SEED_FRONTEND_URL || 'http://localhost:5173';

const TEMPLATE_IMAGE_BASE = `${BASE_URL}/templates/duccuong-nguyenquyet/www.ziuwedding.site/images`;
const img = (file) => `${TEMPLATE_IMAGE_BASE}/${encodeURIComponent(file)}`;

// Ảnh cưới full-res của couple gốc đã được gỡ khỏi gói mẫu để giảm dung lượng.
// Seed demo chỉ dùng 2 ảnh còn lại trong mẫu; khi tạo thiệp thật, chủ thiệp tự
// upload ảnh qua trình sửa (các vùng data-image).
const GALLERY_FILES = ['codau.png', 'chure.png'];

async function main() {
  await sequelize.authenticate();

  let template = await InvitationTemplate.findOne({ where: { template_code: 'duccuong-nguyenquyet' } });
  if (!template) {
    template = await InvitationTemplate.create({
      id: randomUUID(),
      template_code: 'duccuong-nguyenquyet',
      template_name: 'Thiệp cưới cổ điển (LadiPage)',
      html_path: '/templates/duccuong-nguyenquyet/www.ziuwedding.site/vobe2.html',
      status: 'published',
    });
    console.log('Created template:', template.id);
  } else {
    console.log('Template already exists:', template.id);
  }

  let user = await User.findOne({ where: { username: 'demo_minhanh_thuha' } });
  if (!user) {
    user = await User.create({
      id: randomUUID(),
      username: 'demo_minhanh_thuha',
      password: 'demo',
      role: 'user',
      slot: 5,
    });
    console.log('Created demo user:', user.id);
  }

  const groom = await Groom.create({
    id: randomUUID(),
    users_id: user.id,
    name_groom: 'Nguyễn Minh Anh',
    father_grom: 'Nguyễn Văn Hùng',
    mother_groom: 'Lê Thị Hoa',
    province: 'Hà Nội',
    district: 'Cầu Giấy',
    commune: 'Dịch Vọng',
    address: 'Số 12 ngõ 88',
    bank_name: 'Vietcombank',
    bank_account_name: 'NGUYEN MINH ANH',
    bank_account_number: '0011002233',
    create_at: new Date(),
  });

  const bride = await Bride.create({
    id: randomUUID(),
    users_id: user.id,
    name_bride: 'Trần Thu Hà',
    father_bride: 'Trần Văn Long',
    mother_bride: 'Phạm Thị Lan',
    province: 'Hải Phòng',
    district: 'Ngô Quyền',
    commune: 'Máy Tơ',
    address: 'Số 45 đường Lạch Tray',
    bank_name: 'Techcombank',
    bank_account_name: 'TRAN THU HA',
    bank_account_number: '19001122334',
    created_at: new Date(),
  });

  const slug = 'minhanh-thuha-demo';
  await Invitation.destroy({ where: { invitation_slug: slug } });

  const invitation = await Invitation.create({
    id: randomUUID(),
    users_id: user.id,
    template_id: template.id,
    invitation_slug: slug,
    title_vi: 'Lễ Thành Hôn - Minh Anh & Thu Hà',
    title_en: 'Wedding of Minh Anh & Thu Ha',
    groom_id: groom.id,
    bride_id: bride.id,
    // Lưu giờ VN dạng "giờ tường thuật" trực tiếp bằng UTC hour (khớp cách
    // TemplateLoader đọc bằng getUTC* để tránh lệch ngày với field DATEONLY).
    ceremony_date: new Date(Date.UTC(2026, 10, 14, 16, 0, 0)), // 14/11/2026 16:00
    ceremony_lunar_text: 'Tức ngày 05 tháng 10 năm Bính Ngọ',
    reception_date: '2026-11-15',
    reception_lunar_text: 'Tức ngày 06 tháng 10 năm Bính Ngọ',
    venue_address: 'Trung tâm tiệc cưới Hoa Sen, Cầu Giấy',
    map_url: 'https://maps.app.goo.gl/example1',
    reception_venue_address: 'Nhà hàng Sông Hồng, Ngô Quyền',
    reception_map_url: 'https://maps.app.goo.gl/example2',
    thank_you_message: 'Sự hiện diện của bạn là niềm hạnh phúc lớn lao với gia đình chúng tôi. Chân thành cảm ơn!',
    extra_notes: 'Demo seed cho test template duccuong-nguyenquyet',
    music_url: `${BASE_URL}/media/music/${encodeURIComponent('Vocaroo 1tWvK6cKvsyz.mp3')}`,
    extra_data: {
      love_quote_1: '"Yêu là khi hai trái tim tìm thấy nhau giữa muôn trùng."',
      love_quote_2: '"Từ hôm nay, mọi hành trình đều có đôi."',
    },
  });

  await InvitationImage.bulkCreate([
    { id: randomUUID(), invitation_id: invitation.id, image_url: img('codau.png'), image_alt: 'Cô dâu', image_type: 'bride_photo', sort_order: 0, is_cover: false },
    { id: randomUUID(), invitation_id: invitation.id, image_url: img('chure.png'), image_alt: 'Chú rể', image_type: 'groom_photo', sort_order: 0, is_cover: false },
    ...GALLERY_FILES.map((file, idx) => ({
      id: randomUUID(),
      invitation_id: invitation.id,
      image_url: img(file),
      image_alt: `Gallery ${idx + 1}`,
      image_type: 'gallery',
      sort_order: idx,
      is_cover: idx === 0,
    })),
  ]);

  console.log('Seed complete.');
  console.log('Slug:', invitation.invitation_slug);
  console.log('Public URL:', `${FRONTEND_URL}/${invitation.invitation_slug}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
