# Mẫu Blue Botanical — các trường chỉnh sửa được

Mẫu này chạy ở hai nơi và **không cần sửa gì để chuyển qua lại**:

- Mở trực tiếp `index.html` → hiện dữ liệu demo trong `assets/js/wedding-data.js`.
- Nhúng trong hệ thống thiệp → nền tảng bơm dữ liệu thật của thiệp vào, đè lên demo.

## Cách hoạt động

Nền tảng bơm `window.invitationData` vào `<head>` trước mọi script của mẫu, rồi tìm
các phần tử có `data-field` / `data-image` để điền nội dung. Ở chế độ sửa, chủ thiệp
bấm thẳng vào các phần tử đó để đổi chữ hoặc đổi ảnh.

Ba cầu nối đã thêm vào mẫu:

1. `assets/js/wedding-data.js` — hàm `wwPick()` đọc dữ liệu thật, không có thì trả
   về giá trị demo. Nhờ vậy `countdown.js`, `modals.js` và máy đĩa than dùng đúng dữ
   liệu thay vì ngày cưới demo.
2. `assets/js/modals.js` — khối "Ngày mời" nay ghi vào từng ô `[data-field]` con thay
   vì thay sạch cả khối (thay sạch sẽ xoá mất ô bấm-để-sửa).
3. Cuối `index.html` — gọi lại bộ bơm của nền tảng sau `window.load`, để các script
   `defer` của mẫu không ghi đè lên dữ liệu thật.

## Trường chữ (`data-field`)

### Lấy thẳng từ hồ sơ cô dâu / chú rể
| Trường | Ý nghĩa | Nguồn |
|---|---|---|
| `groom_name` / `bride_name` | Họ tên đầy đủ | bảng groom / bride |
| `groom_short_name` / `bride_short_name` | Tên gọi (chữ cuối) | tự tính |
| `groom.father_grom` / `groom.mother_groom` | Cha, mẹ nhà trai | bảng groom |
| `bride.father_bride` / `bride.mother_bride` | Cha, mẹ nhà gái | bảng bride |
| `groom.address` / `bride.address` | Quê quán hai bên | bảng groom / bride |

### Lễ thành hôn
| Trường | Ý nghĩa |
|---|---|
| `ceremony_short` | Ngày lễ dạng `20.11.2027` |
| `ceremony_weekday` | Thứ trong tuần |
| `ceremony_time_weekday` | `17:30, Thứ Bảy` |
| `ceremony_lunar_text` | Ngày âm lịch |
| `venue_address` | Địa chỉ làm lễ |
| `map_url` | Link chỉ đường lễ (dùng `data-field-href`) |

### Tiệc cưới ("Ngày mời")
| Trường | Ý nghĩa |
|---|---|
| `reception_short` / `reception_weekday` | Ngày & thứ đãi tiệc |
| `reception_lunar_text` | Ngày âm lịch tiệc |
| `reception_venue_address` | Địa chỉ nhà hàng |
| `reception_map_url` | Link chỉ đường tiệc |

### Trường riêng của mẫu (lưu trong `extra_data`)
`monogram`, `wedding_tag`, `envelope_subtext`, `welcome_quote`, `welcome_text`,
`family_lead_text`, `invitation_greeting`, `invitation_greeting_sub`,
`reception_time`, `reception_venue_name`, `ceremony_intro`, `venue_name`,
`ceremony_heartfelt_quote`, `story_quote`, `story_content`, `footer_thank_you`,
`vinyl_track_text`, `podcast_title`, `groom_transfer_note`, `bride_transfer_note`,
`timeline_time_1..4`, `timeline_title_1..4`, `timeline_desc_1..4`.

> `reception_time` tồn tại vì cột `reception_date` trong CSDL chỉ lưu NGÀY, không có
> giờ. Giờ đãi tiệc do chủ thiệp tự nhập.

## Ô ảnh (`data-image`)

| Giá trị | Vị trí trong thiệp | Số lượng |
|---|---|---|
| `cover` | Ảnh bìa hero, thiệp Save the Date, đĩa than | 1 ảnh dùng cho 3 ô |
| `groom` | Polaroid chú rể | 1 |
| `bride` | Polaroid cô dâu | 1 |
| `story` | Ảnh mục "Chuyện chúng mình" | 1 |
| `gallery` | Album ảnh (`data-image-index` 0–4) | 5 |
| `bank_qr` | Mã QR mừng cưới (ô thứ hai dùng `data-image-index="1"`) | tối đa 2 |

Ảnh bìa được ưu tiên tải trước (`fetchpriority="high"`); các ảnh còn lại lazy-load.

> **Ô QR chưa có mã thật sẽ bị ẩn**, không giữ lại ảnh QR mẫu của gói template —
> mã mẫu là số tài khoản có thật của người khác, khách quét vào sẽ chuyển tiền nhầm.

## Khối chỉ hiển thị, không sửa tại chỗ

Thông tin ngân hàng (tên ngân hàng, chủ tài khoản, số tài khoản) gắn thêm
`data-readonly`: vẫn hiện dữ liệu thật, nhưng không bấm sửa trực tiếp được. Sửa qua
panel quét mã QR trong trình soạn thiệp — sửa tay ở đây sẽ ghi sai vào `extra_data`.
