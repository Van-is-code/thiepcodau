# README_FE

Tai lieu nay mo ta form FE de khop voi BE hien tai.
Quy uoc:
- `text`: nguoi dung nhap tay.
- `option`: FE goi API de lay danh sach lua chon tu DB.
- `auto`: BE tu sinh, FE khong gui len.

## 1) Header va Auth

- Base URL: `http://localhost:3000/api`
- Cac API can token: gui header `Authorization: Bearer <TOKEN>`
- Cac API public:
  - `POST /users/register`
  - `POST /users/login`
  - `GET/POST/PUT/PATCH/DELETE /messages-checkins...`

## 2) Users Form

### 2.1 Register
- Endpoint: `POST /users/register`
- Fields:
  - `username`: text
  - `password`: text
  - `role`: option (`user`, `admin`) hoac text

### 2.2 Login
- Endpoint: `POST /users/login`
- Fields:
  - `username`: text
  - `password`: text

### 2.3 Profile
- Endpoint: `GET /users/profile`, `PATCH /users/profile`
- Fields update:
  - `username`: text
  - `role`: option (`user`, `admin`) hoac text

### 2.4 Change Password
- Endpoint: `POST /users/change-password`
- Fields:
  - `currentPassword`: text
  - `newPassword`: text

## 3) Invitation Templates Form

- Endpoint CRUD: `/invitation-templates`
- Fields create/update:
  - `template_code`: text
  - `template_name`: text
  - `html_path`: text
- Auto:
  - `id`: auto
  - `created_at`: auto

## 4) Groom Form

- Endpoint CRUD: `/grooms`
- Fields create/update:
  - `name_groom`: text
  - `father_grom`: text
  - `mother_groom`: text
  - `province`: text
  - `district`: text
  - `commune`: text
  - `address`: text
  - `bank_name`: text
  - `bank_account_name`: text
  - `bank_account_number`: text
- Auto:
  - `id`: auto
  - `users_id`: auto tu token
  - `create_at`, `updated_at`: auto

## 5) Bride Form

- Endpoint CRUD: `/brides`
- Fields create/update:
  - `name_bride`: text
  - `father_bride`: text
  - `mother_bride`: text
  - `province`: text
  - `district`: text
  - `commune`: text
  - `address`: text
  - `bank_name`: text
  - `bank_account_name`: text
  - `bank_account_number`: text
- Auto:
  - `id`: auto
  - `users_id`: auto tu token
  - `created_at`, `updated_at`: auto

## 6) Invitation Form

- Endpoint CRUD: `/invitations`
- Fields create/update:
  - `template_id`: option (GET `/invitation-templates`)
  - `groom_id`: option (GET `/grooms`)
  - `bride_id`: option (GET `/brides`)
  - `invitation_slug`: text
  - `title_vi`: text
  - `title_en`: text
  - `ceremony_date`: text (datetime)
  - `ceremony_lunar_text`: text
  - `reception_date`: text (date)
  - `reception_lunar_text`: text
  - `venue_address`: text
  - `map_url`: text
  - `reception_venue_address`: text
  - `reception_map_url`: text
  - `thank_you_message`: text
  - `extra_notes`: text
- Auto:
  - `id`: auto
  - `users_id`: auto tu token
  - `music_url`: auto random tu `media/music` khi create
  - `created_at`, `updated_at`: auto

## 7) Guest Form

- Endpoint CRUD: `/guests`
- Fields create:
  - `name`: text
  - `description`: text
  - `invitation_id`: option (GET `/invitations`) - bat buoc
- Fields update:
  - `name`: text
  - `description`: text
- Auto:
  - `id`: auto
  - `users_id`: auto tu token
  - `created_at`, `updated_at`: auto
  - Tu dong tao record `private_invitation` sau khi tao guest

## 8) Private Invitation Form

- Endpoint CRUD: `/private-invitations`
- Khuyen nghi FE: chi doc/hien thi, vi he thong da tu tao khi tao guest.
- Neu van can tao tay:
  - `guest_id`: option (GET `/guests`)
  - `invitationns_id`: option (GET `/invitations`)
  - `url`: text
- Auto:
  - `id`: auto
  - `created_at`, `updated_at`: auto

## 9) Invitation Images Form (upload local)

- Endpoint CRUD: `/invitation-images`
- Create/Update dung `multipart/form-data`
- Fields create:
  - `image`: file (bat buoc)
  - `invitation_id`: option (GET `/invitations`) - bat buoc
  - `image_alt`: text
  - `image_type`: option (`gallery`, `cover`, ...) hoac text
  - `sort_order`: text/number
  - `is_cover`: option (`true`, `false`)
- Fields update:
  - `image`: file (optional, de thay anh)
  - `invitation_id`: option (optional)
  - `image_alt`: text
  - `image_type`: text/option
  - `sort_order`: text/number
  - `is_cover`: option (`true`, `false`)
- Auto:
  - `id`: auto
  - `users_id`: auto tu token
  - `image_url`: auto luu local theo `uploads/images/<invitation_id>/...`
  - `created_at`: auto

## 10) Messages Checkins Form (public, khong token)

- Endpoint CRUD: `/messages-checkins`
- Fields create:
  - `invitation_id`: option (GET `/invitations`) - bat buoc
  - `guest_id`: option (GET `/guests`) - optional
  - `name_guest`: text
  - `messages`: text
  - `confirm_attendance`: option (`yes`, `no`, `pending`) hoac text
  - `number_of_attendees`: text/number
  - `guests_type`: text
- Auto:
  - `id`: auto
  - `created_at`: auto

## 11) Music Upload Form (cap nhat nhac cho invitation)

- Endpoint: `POST /media-upload/music/local`
- Header: token bat buoc
- `multipart/form-data` fields:
  - `music`: file (bat buoc)
  - `invitation_id`: option (GET `/invitations`) - bat buoc
- Ket qua:
  - File nhac luu vao `uploads/music/<users_id>/...`
  - BE tu cap nhat `music_url` cua invitation vua chon
  - Nhac mac dinh trong `media/music` khong bi xoa

## 12) Man hinh goi y cho FE

- Tao invitation:
  - Dropdown template, groom, bride
  - Cac field text con lai
- Tao guest:
  - Dropdown invitation
  - Name/description text
  - Sau khi tao, FE co the hien `privateInvitation.url` tu API guest
- Them anh invitation:
  - Dropdown invitation
  - File image
  - Alt/type/sort/is_cover
- Tao message checkin:
  - Public form, khong can login
  - Dropdown invitation
  - Dropdown guest (optional)

## 13) Truong FE khong duoc gui len

- `id`
- `users_id`
- `created_at`
- `updated_at`
- `create_at`
- `image_url` (doi voi upload anh local)
- `music_url` (doi voi tao invitation, BE tu set; doi voi upload music, BE tu cap nhat)
