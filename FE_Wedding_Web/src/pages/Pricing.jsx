import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconCreditCard,
  IconSparkles,
  IconChevronLeft,
  IconCheckCircle,
  IconMail,
  IconHeart,
} from '../components/Icons'

export default function Pricing() {
  const navigate = useNavigate()

  return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.bar} />
        <div style={S.body}>
          <div style={S.iconBox}>
            <IconCreditCard size={28} color="#d97757" />
          </div>

          <h1 style={S.title}>Thêm Lượt Tạo Thiệp Cưới</h1>

          <p style={S.lead}>
            Hiện hệ thống chưa mở thanh toán trực tuyến tự động. Để được cấp thêm <strong>lượt tạo thiệp</strong> hoặc mở khoá sửa thiệp cưới, quý khách vui lòng <strong>liên hệ trực tiếp Quản trị viên</strong>.
          </p>

          <div style={S.listBox}>
            <div style={S.listItem}>
              <IconCheckCircle size={16} color="#4f7e65" />
              <span>Nhắn tin cho Admin số lượng lượt tạo thiệp quý khách cần</span>
            </div>
            <div style={S.listItem}>
              <IconCheckCircle size={16} color="#4f7e65" />
              <span>Admin sẽ cấp slot trực tiếp vào tài khoản ngay sau khi xác nhận</span>
            </div>
            <div style={S.listItem}>
              <IconCheckCircle size={16} color="#4f7e65" />
              <span>Số lượt còn lại luôn hiển thị minh bạch tại trang “Danh Sách Thiệp”</span>
            </div>
          </div>

          <button style={S.btn} onClick={() => navigate('/dashboard')}>
            <IconChevronLeft size={16} />
            <span>Quay Lại Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  root: {
    minHeight: '100vh',
    background: '#fcfaf7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  card: {
    width: 'min(500px, 100%)',
    background: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 20px 50px -10px rgba(31, 25, 23, 0.12)',
    border: '1px solid #ede5db',
    animation: 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  bar: {
    height: 5,
    background: 'linear-gradient(90deg, #d97757 0%, #c9a96e 100%)',
  },
  body: {
    padding: '40px 36px 36px',
    textAlign: 'center',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    background: 'rgba(217, 119, 87, 0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 24,
    fontWeight: 700,
    margin: '8px 0 14px',
    color: '#1f1917',
    lineHeight: 1.25,
  },
  lead: {
    fontSize: 14.5,
    lineHeight: 1.7,
    color: '#5c524c',
  },
  listBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    textAlign: 'left',
    margin: '24px auto 28px',
    background: '#f6f1eb',
    padding: '18px 20px',
    borderRadius: 16,
    border: '1px solid #ede5db',
  },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13.5,
    color: '#3d332e',
    lineHeight: 1.5,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    boxShadow: '0 4px 16px rgba(217, 119, 87, 0.35)',
    transition: 'all 0.2s ease',
  },
}
