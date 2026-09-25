import React, { useState, useEffect } from 'react'
import {
  IconSparkles,
  IconEdit3,
  IconImage,
  IconMusic,
  IconQrCode,
  IconCheckCircle,
  IconChevronRight,
  IconChevronLeft,
  IconX,
} from './Icons'

const STEPS = [
  {
    badge: 'Khám phá ngay',
    title: 'Chào mừng bạn đến với Trình Sửa Thiệp!',
    desc: 'Tại đây bạn có thể tự do biến hoá mẫu thiệp thành tác phẩm cưới của riêng mình. Mọi thao tác đều trực quan — nhìn thấy gì là chạm vào sửa được ngay!',
    Icon: IconSparkles,
    color: '#d97757',
    tip: 'Mẹo: Bạn có thể xem lại hướng dẫn này bất kỳ lúc nào bằng nút ❓ Hướng Dẫn trên thanh công cụ.',
  },
  {
    badge: 'Chỉnh sửa văn bản',
    title: 'Chạm vào chữ trên thiệp để sửa trực tiếp',
    desc: 'Bấm thẳng vào tên Chú Rể, Cô Dâu, ngày giờ tổ chức, địa chỉ lễ cưới hoặc nhà hàng trên thiệp để gõ thay đổi nội dung tức thì.',
    Icon: IconEdit3,
    color: '#3b82f6',
    tip: 'Khung viền tím nhạt quanh chữ biểu thị những vùng cho phép bạn chạm vào để sửa.',
  },
  {
    badge: 'Thay thế ảnh cưới',
    title: 'Chạm vào khung ảnh để tải ảnh của bạn',
    desc: 'Bấm trực tiếp vào các khung ảnh mẫu trên thiệp để tải ảnh cưới của bạn lên. Công cụ cắt & xoay ảnh tích hợp sẵn sẽ giúp ảnh vừa khít tỷ lệ khung.',
    Icon: IconImage,
    color: '#10b981',
    tip: 'Nên chọn ảnh rõ nét, độ phân giải cao để thiệp hiển thị đẹp nhất trên điện thoại khách mời.',
  },
  {
    badge: 'Bộ sưu tập ảnh',
    title: 'Thêm nhiều ảnh vào Album cưới',
    desc: 'Bấm nút "Thêm Ảnh Album" trên thanh công cụ trên cùng để chọn nhiều ảnh cưới cùng lúc, tạo album trượt ảnh lãng mạn cho khách thưởng thức.',
    Icon: IconSparkles,
    color: '#8b5cf6',
    tip: 'Có thể chọn từ 3 đến 10+ bức ảnh đẹp nhất trong buổi chụp hình cưới của hai bạn.',
  },
  {
    badge: 'Âm thanh sống động',
    title: 'Cài đặt Nhạc nền & Ghi âm lời chúc',
    desc: 'Bấm nút "Âm Thanh & Nhạc" để chọn bài hát cưới từ kho nhạc hệ thống, tải bài hát của riêng bạn, hoặc tự ghi âm giọng nói ấm áp gửi đến khách. Bạn có thể tùy chỉnh riêng âm lượng nhạc và lời ghi âm!',
    Icon: IconMusic,
    color: '#ec4899',
    tip: 'Có thể bật chế độ tự động giảm nhỏ nhạc nền khi đang phát giọng ghi âm để lời chúc vang lên rõ ràng.',
  },
  {
    badge: 'Mừng cưới hiện đại',
    title: 'Cài đặt QR Mừng Cưới ngân hàng',
    desc: 'Bấm nút "QR Ngân Hàng" trên thanh công cụ để quét ảnh QR hoặc nhập STK. Hệ thống tự động tạo mã VietQR chuẩn xác gắn vào thiệp để khách mừng cưới tiện lợi.',
    Icon: IconQrCode,
    color: '#f59e0b',
    tip: 'Chỉ cần quét 1 ảnh QR tài khoản của bạn, hệ thống sẽ tự động bóc tách số tài khoản & tên ngân hàng.',
  },
  {
    badge: 'Hoàn tất & Chia sẻ',
    title: 'Lưu thiệp và Gửi tới khách mời',
    desc: 'Sau khi chỉnh sửa xong, bấm "Lưu Thiệp" để lưu lại kết quả. Sau đó bấm "Xem Thiệp" để lấy đường link và mã QR thiệp gửi cho toàn thể bạn bè, gia đình!',
    Icon: IconCheckCircle,
    color: '#4f7e65',
    tip: 'Bạn còn có thể tải file danh sách khách mời để tạo từng đường link riêng có tên khách trân trọng.',
  },
]

export default function EditorTourGuide({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isOpen) setStep(0)
  }, [isOpen])

  if (!isOpen) return null

  const cur = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const CurrentIcon = cur.Icon

  const handleNext = () => {
    if (isLast) {
      onComplete && onComplete()
      onClose && onClose()
    } else {
      setStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) setStep((s) => s - 1)
  }

  const handleSkip = () => {
    onComplete && onComplete()
    onClose && onClose()
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && handleSkip()}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...S.badge, color: cur.color, borderColor: `${cur.color}40`, background: `${cur.color}15` }}>
              {cur.badge}
            </span>
            <span style={S.stepCount}>
              Bước {step + 1} / {STEPS.length}
            </span>
          </div>
          <button style={S.closeBtn} onClick={handleSkip} title="Đóng hướng dẫn">
            <IconX size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div style={S.body}>
          <div style={{ ...S.iconBox, background: `linear-gradient(135deg, ${cur.color}20 0%, ${cur.color}08 100%)`, color: cur.color }}>
            <CurrentIcon size={36} />
          </div>

          <h3 style={S.title}>{cur.title}</h3>
          <p style={S.desc}>{cur.desc}</p>

          <div style={S.tipBox}>
            <span style={S.tipIcon}>💡</span>
            <span style={S.tipText}>{cur.tip}</span>
          </div>
        </div>

        {/* Footer Navigation */}
        <div style={S.footer}>
          {/* Progress dots */}
          <div style={S.dots}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                onClick={() => setStep(i)}
                style={{
                  ...S.dot,
                  background: i === step ? cur.color : '#e2d9cf',
                  width: i === step ? 22 : 7,
                }}
              />
            ))}
          </div>

          <div style={S.btnGroup}>
            {!isFirst && (
              <button style={S.btnSecondary} onClick={handlePrev}>
                <IconChevronLeft size={16} /> Quay lại
              </button>
            )}

            <button style={S.btnSkip} onClick={handleSkip}>
              Bỏ qua
            </button>

            <button style={{ ...S.btnPrimary, background: cur.color }} onClick={handleNext}>
              <span>{isLast ? 'Bắt đầu sáng tạo!' : 'Tiếp theo'}</span>
              {!isLast && <IconChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(25, 20, 18, 0.65)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    animation: 'fadeIn 0.25s ease',
  },
  card: {
    width: 'min(520px, 100%)',
    background: '#ffffff',
    borderRadius: 22,
    boxShadow: '0 28px 70px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(230, 220, 210, 0.8)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 14px',
    borderBottom: '1px solid #f3ece4',
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
  },
  stepCount: {
    fontSize: 12,
    color: '#8c7d75',
    fontWeight: 600,
  },
  closeBtn: {
    background: '#f8f4ee',
    border: 'none',
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7a6c65',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  body: {
    padding: '24px 28px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.05)',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#211a17',
    margin: '0 0 10px',
    lineHeight: 1.35,
  },
  desc: {
    fontSize: 13.5,
    color: '#655750',
    lineHeight: 1.65,
    margin: '0 0 18px',
    maxWidth: 440,
  },
  tipBox: {
    background: '#faf6f0',
    border: '1px dashed #e3d5c5',
    borderRadius: 12,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
  },
  tipIcon: {
    fontSize: 14,
    flexShrink: 0,
    marginTop: 1,
  },
  tipText: {
    fontSize: 12,
    color: '#7b685e',
    lineHeight: 1.5,
  },
  footer: {
    padding: '16px 24px 20px',
    borderTop: '1px solid #f3ece4',
    background: '#fdfbf9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  dots: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 7,
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  btnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid #e0d4c7',
    background: '#fff',
    color: '#554740',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSkip: {
    background: 'none',
    border: 'none',
    color: '#9e9087',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 10px',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    borderRadius: 10,
    border: 'none',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
    transition: 'transform 0.1s ease',
  },
}
