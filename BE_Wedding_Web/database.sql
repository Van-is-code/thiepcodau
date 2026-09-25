CREATE TABLE IF NOT EXISTS "invitation_templates" (
	"id" UUID,
	-- Mã mẫu thiệp (duy nhất)
	"template_code" VARCHAR(50) NOT NULL UNIQUE,
	-- Tên mẫu thiệp hiển thị
	"template_name" VARCHAR(255) NOT NULL,
	-- Đường dẫn file HTML của mẫu
	"html_path" VARCHAR(500) NOT NULL,
	-- Thời điểm tạo bản ghi
	"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);


COMMENT ON COLUMN "invitation_templates"."template_code" IS 'Mã mẫu thiệp (duy nhất)';
COMMENT ON COLUMN "invitation_templates"."template_name" IS 'Tên mẫu thiệp hiển thị';
COMMENT ON COLUMN "invitation_templates"."html_path" IS 'Đường dẫn file HTML của mẫu';
COMMENT ON COLUMN "invitation_templates"."created_at" IS 'Thời điểm tạo bản ghi';


CREATE TABLE IF NOT EXISTS "invitations" (
	"id" UUID,
	"users_id" UUID,
	-- Khóa ngoại sang mẫu thiệp
	"template_id" UUID NOT NULL,
	-- Slug thiệp dùng trên URL
	"invitation_slug" VARCHAR(100) NOT NULL UNIQUE,
	-- Tiêu đề tiếng Việt
	"title_vi" VARCHAR(255) NOT NULL,
	-- Tiêu đề tiếng Anh (nếu có)
	"title_en" VARCHAR(255) NOT NULL,
	-- Tên chú rể
	"groom_id" UUID NOT NULL,
	-- Tên cô dâu
	"bride_id" UUID NOT NULL,
	-- Ngày lễ thành hôn
	"ceremony_date" TIMESTAMP NOT NULL,
	-- Ngày âm lịch của lễ thành hôn
	"ceremony_lunar_text" VARCHAR(255) NOT NULL,
	-- Ngày tiệc cưới
	"reception_date" DATE NOT NULL,
	-- Ngày âm lịch của tiệc cưới
	"reception_lunar_text" VARCHAR(255) NOT NULL,
	-- Địa chỉ địa điểm tổ chức
	"venue_address" VARCHAR(500) NOT NULL,
	-- Liên kết bản đồ
	"map_url" VARCHAR(500) NOT NULL,
	"reception_venue_address" VARCHAR(255) NOT NULL,
	"reception_map_url" VARCHAR(255) NOT NULL,
	-- Lời cảm ơn sau RSVP
	"thank_you_message" TEXT NOT NULL,
	-- Ghi chú bổ sung
	"extra_notes" TEXT NOT NULL,
	"music_url" VARCHAR(255) NOT NULL,
	-- Thời điểm tạo bản ghi
	"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	-- Thời điểm cập nhật gần nhất
	"updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);


COMMENT ON COLUMN "invitations"."template_id" IS 'Khóa ngoại sang mẫu thiệp';
COMMENT ON COLUMN "invitations"."invitation_slug" IS 'Slug thiệp dùng trên URL';
COMMENT ON COLUMN "invitations"."title_vi" IS 'Tiêu đề tiếng Việt';
COMMENT ON COLUMN "invitations"."title_en" IS 'Tiêu đề tiếng Anh (nếu có)';
COMMENT ON COLUMN "invitations"."groom_id" IS 'Tên chú rể';
COMMENT ON COLUMN "invitations"."bride_id" IS 'Tên cô dâu';
COMMENT ON COLUMN "invitations"."ceremony_date" IS 'Ngày lễ thành hôn';
COMMENT ON COLUMN "invitations"."ceremony_lunar_text" IS 'Ngày âm lịch của lễ thành hôn';
COMMENT ON COLUMN "invitations"."reception_date" IS 'Ngày tiệc cưới';
COMMENT ON COLUMN "invitations"."reception_lunar_text" IS 'Ngày âm lịch của tiệc cưới';
COMMENT ON COLUMN "invitations"."venue_address" IS 'Địa chỉ địa điểm tổ chức';
COMMENT ON COLUMN "invitations"."map_url" IS 'Liên kết bản đồ';
COMMENT ON COLUMN "invitations"."thank_you_message" IS 'Lời cảm ơn sau RSVP';
COMMENT ON COLUMN "invitations"."extra_notes" IS 'Ghi chú bổ sung';
COMMENT ON COLUMN "invitations"."created_at" IS 'Thời điểm tạo bản ghi';
COMMENT ON COLUMN "invitations"."updated_at" IS 'Thời điểm cập nhật gần nhất';


CREATE TABLE IF NOT EXISTS "guest" (
	"id" UUID DEFAULT uuid_generate_v4(),
	"users_id" UUID,
	"name" TEXT NOT NULL,
	"description" TEXT,
	"created_at" TIMESTAMP DEFAULT NOW(),
	"updated_at" TIMESTAMP DEFAULT NOW(),
	PRIMARY KEY("id")
);




CREATE TABLE IF NOT EXISTS "private_invitation" (
	"id" UUID DEFAULT uuid_generate_v4(),
	"guest_id" UUID UNIQUE,
	"url" TEXT NOT NULL,
	"created_at" TIMESTAMP DEFAULT NOW(),
	"updated_at" TIMESTAMP DEFAULT NOW(),
	"invitationns_id" UUID,
	PRIMARY KEY("id")
);


CREATE INDEX "idx_invitation_guest_id"
ON "private_invitation" ("guest_id");
CREATE UNIQUE INDEX "idx_private_invitation_url"
ON "private_invitation" ("url");

CREATE TABLE IF NOT EXISTS "messages_checkins" (
	"id" UUID DEFAULT uuid_generate_v4(),
	"invitation_id" UUID NOT NULL,
	"guest_id" UUID NOT NULL,
	"name_guest" TEXT NOT NULL,
	"messages" TEXT,
	"confirm_attendance" TEXT,
	"number_of_attendees" INTEGER,
	"guests_type" TEXT,
	"created_at" TIMESTAMP DEFAULT NOW(),
	PRIMARY KEY("id")
);


CREATE INDEX "idx_messages_guest_id"
ON "messages_checkins" ("guest_id");

CREATE TABLE IF NOT EXISTS "groom" (
	"id" UUID NOT NULL UNIQUE,
	"users_id" UUID NOT NULL,
	"name_groom" VARCHAR(255) NOT NULL,
	"father_grom" VARCHAR(255) NOT NULL,
	"mother_groom" VARCHAR(255) NOT NULL,
	"province" VARCHAR(255) NOT NULL,
	"district" VARCHAR(255) NOT NULL,
	"commune" VARCHAR(255) NOT NULL,
	"address" VARCHAR(255) NOT NULL,
	"bank_name" VARCHAR(255) NOT NULL,
	"bank_account_name" VARCHAR(255) NOT NULL,
	"bank_account_number" VARCHAR(255) NOT NULL,
	"create_at" TIMESTAMP NOT NULL,
	"updated_at" TIMESTAMP,
	PRIMARY KEY("id")
);




CREATE TABLE IF NOT EXISTS "bride" (
	"id" UUID UNIQUE,
	"users_id" UUID NOT NULL,
	"name_bride" VARCHAR(255) NOT NULL,
	"father_bride" VARCHAR(255) NOT NULL,
	"mother_bride" VARCHAR(255) NOT NULL,
	"province" VARCHAR(255) NOT NULL,
	"district" VARCHAR(255) NOT NULL,
	"commune" VARCHAR(255) NOT NULL,
	"address" VARCHAR(255) NOT NULL,
	"bank_name" VARCHAR(255) NOT NULL,
	"bank_account_name" VARCHAR(255) NOT NULL,
	"bank_account_number" VARCHAR(255) NOT NULL,
	"created_at" TIMESTAMP NOT NULL,
	"updated_at" VARCHAR(255),
	PRIMARY KEY("id")
);




CREATE TABLE IF NOT EXISTS "users" (
	"id" UUID NOT NULL UNIQUE,
	"username" VARCHAR(255),
	"password" VARCHAR(255),
	"role" VARCHAR(255),
	"created_at" TIMESTAMP,
	"updated_at" TIMESTAMP,
	PRIMARY KEY("id")
);




CREATE TABLE IF NOT EXISTS "invitation_images" (
	"id" UUID DEFAULT uuid_generate_v4(),
	"users_id" UUID,
	-- Khóa ngoại sang thiệp cưới
	"invitation_id" UUID NOT NULL,
	-- URL hoặc đường dẫn ảnh
	"image_url" VARCHAR(500) NOT NULL,
	-- Mô tả ảnh (alt text)
	"image_alt" VARCHAR(255) NOT NULL,
	-- Loại ảnh: gallery, hero, banner...
	"image_type" VARCHAR(50) NOT NULL,
	-- Thứ tự hiển thị ảnh
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	-- Ảnh đại diện của thiệp (0/1)
	"is_cover" BLOB(1) NOT NULL DEFAULT 0,
	-- Thời điểm tạo bản ghi
	"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);


COMMENT ON COLUMN "invitation_images"."invitation_id" IS 'Khóa ngoại sang thiệp cưới';
COMMENT ON COLUMN "invitation_images"."image_url" IS 'URL hoặc đường dẫn ảnh';
COMMENT ON COLUMN "invitation_images"."image_alt" IS 'Mô tả ảnh (alt text)';
COMMENT ON COLUMN "invitation_images"."image_type" IS 'Loại ảnh: gallery, hero, banner...';
COMMENT ON COLUMN "invitation_images"."sort_order" IS 'Thứ tự hiển thị ảnh';
COMMENT ON COLUMN "invitation_images"."is_cover" IS 'Ảnh đại diện của thiệp (0/1)';
COMMENT ON COLUMN "invitation_images"."created_at" IS 'Thời điểm tạo bản ghi';

ALTER TABLE "invitations"
ADD FOREIGN KEY("template_id") REFERENCES "invitation_templates"("id")
ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "private_invitation"
ADD FOREIGN KEY("guest_id") REFERENCES "guest"("id")
ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "messages_checkins"
ADD FOREIGN KEY("guest_id") REFERENCES "guest"("id")
ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "invitations"
ADD FOREIGN KEY("id") REFERENCES "private_invitation"("invitationns_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "groom"
ADD FOREIGN KEY("id") REFERENCES "invitations"("groom_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "bride"
ADD FOREIGN KEY("id") REFERENCES "invitations"("bride_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "invitations"
ADD FOREIGN KEY("id") REFERENCES "messages_checkins"("invitation_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "users"
ADD FOREIGN KEY("id") REFERENCES "guest"("users_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "users"
ADD FOREIGN KEY("id") REFERENCES "invitations"("users_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "invitation_images"
ADD FOREIGN KEY("invitation_id") REFERENCES "invitations"("id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "users"
ADD FOREIGN KEY("id") REFERENCES "invitation_images"("users_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "users"
ADD FOREIGN KEY("id") REFERENCES "bride"("users_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE "users"
ADD FOREIGN KEY("id") REFERENCES "groom"("users_id")
ON UPDATE NO ACTION ON DELETE NO ACTION;