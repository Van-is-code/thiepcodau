import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  IconCheckCircle,
  IconCreditCard,
  IconSparkles,
  IconChevronLeft,
} from '../components/Icons'

const css = `
  .payment-success-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 20% 20%, rgba(201, 169, 110, 0.15), transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(217, 119, 87, 0.15), transparent 50%),
      var(--bg-main);
    font-family: var(--font-sans);
  }

  .payment-success-card {
    width: min(580px, 100%);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-lg);
    padding: 40px 36px;
    text-align: center;
    animation: slideUp 0.4s ease-out;
  }

  .payment-success-icon-box {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(79, 126, 101, 0.12);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  .payment-success-title {
    font-family: var(--font-serif);
    font-size: 36px;
    color: var(--text-main);
    margin-bottom: 12px;
    font-weight: 600;
  }

  .payment-success-text {
    color: var(--text-muted);
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 24px;
  }

  .payment-success-info-box {
    background: var(--bg-subtle);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    margin-bottom: 28px;
    text-align: left;
  }

  .payment-success-meta {
    font-size: 13.5px;
    color: var(--text-main);
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
  }

  .payment-success-meta:last-child {
    margin-bottom: 0;
  }

  .payment-success-meta b {
    color: var(--primary);
  }

  .payment-success-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
`

const asMoney = (value) => {
  const n = Number(value)
  if (Number.isNaN(n) || n <= 0) return null
  return `${n.toLocaleString('vi-VN')} ₫`
}

export default function PaymentSuccess() {
  const location = useLocation()

  const info = useMemo(() => {
    const search = new URLSearchParams(location.search)
    return {
      orderId: search.get('orderId') || '',
      amount: asMoney(search.get('amount')),
    }
  }, [location.search])

  return (
    <>
      <style>{css}</style>
      <main className="payment-success-page">
        <section className="payment-success-card">
          <div className="payment-success-icon-box">
            <IconCheckCircle size={36} color="#4f7e65" />
          </div>

          <h1 className="payment-success-title">Thanh Toán Thành Công</h1>
          <p className="payment-success-text">
            Hệ thống đã xác nhận giao dịch thành công và tự động cộng lượt tạo thiệp vào tài khoản của bạn.
          </p>

          {(info.orderId || info.amount) && (
            <div className="payment-success-info-box">
              {info.orderId && (
                <div className="payment-success-meta">
                  <span>Mã đơn hàng:</span>
                  <b>{info.orderId}</b>
                </div>
              )}
              {info.amount && (
                <div className="payment-success-meta">
                  <span>Số tiền:</span>
                  <b>{info.amount}</b>
                </div>
              )}
            </div>
          )}

          <div className="payment-success-actions">
            <Link className="btn-main" to="/dashboard">
              <IconSparkles size={16} />
              <span>Về Bảng Điều Khiển</span>
            </Link>
            <Link className="btn-ghost" to="/pricing">
              <IconCreditCard size={15} />
              <span>Xem Thêm Slot</span>
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
