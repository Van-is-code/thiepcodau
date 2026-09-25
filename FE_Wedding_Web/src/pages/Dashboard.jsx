import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const Dashboard = () => {
  const navigate = useNavigate()
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchInvitations()
  }, [])

  const fetchInvitations = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getInvitations()
      
      // Handle different response structures
      let invsData = []
      if (response.data?.data) {
        invsData = Array.isArray(response.data.data) ? response.data.data : []
      } else if (Array.isArray(response.data)) {
        invsData = response.data
      }
      
      setInvitations(invsData)
    } catch (err) {
      console.error('Error fetching invitations:', err)
      setError(err.response?.data?.message || err.message || 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Bảng Điều Khiển</h1>
        <div>
          <button
            onClick={() => navigate('/pricing')}
            style={{ ...styles.btn, marginRight: '10px' }}
          >
            Mua Thêm Slots
          </button>
          <button onClick={() => navigate('/profile')} style={styles.btn}>
            Hồ Sơ
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('token')
              navigate('/auth')
            }}
            style={{ ...styles.btn, background: '#e07b6a' }}
          >
            Đăng Xuất
          </button>
        </div>
      </div>

      {loading && (
        <div style={styles.loadingContainer}>
          <p style={styles.loadingText}>⏳ Đang tải thiệp của bạn...</p>
        </div>
      )}

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>❌ Lỗi: {error}</p>
          <p style={styles.errorDetail}>
            Hãy kiểm tra:
            <br />
            • Token có hợp lệ không (mở DevTools → Console)
            <br />
            • API endpoint có chính xác: https://api.thiepcuoi.me/
            <br />
            • Backend có đang chạy không
          </p>
          <button onClick={fetchInvitations} style={styles.retryBtn}>
            🔃 Thử Lại
          </button>
        </div>
      )}

      {!loading && !error && invitations.length === 0 && (
        <div style={styles.emptyContainer}>
          <p style={styles.emptyText}>📭 Bạn chưa có thiệp nào</p>
          <button
            onClick={() => navigate('/pricing')}
            style={{ ...styles.btn, marginTop: '20px' }}
          >
            Tạo Thiệp Mới
          </button>
        </div>
      )}

      <div style={styles.grid}>
        {Array.isArray(invitations) && invitations.map((inv) => (
          <div key={inv.id} style={styles.card}>
            <h3>{inv.title_vi || 'Thiệp Không Tiêu Đề'}</h3>
            <p>
              <strong>Chú rể:</strong> {inv.groom?.name_groom || inv.groom || 'N/A'}
            </p>
            <p>
              <strong>Cô dâu:</strong> {inv.bride?.name_bride || inv.bride || 'N/A'}
            </p>
            <p>
              <strong>Ngày cưới:</strong>{' '}
              {inv.ceremony_date
                ? new Date(inv.ceremony_date).toLocaleDateString('vi-VN')
                : 'N/A'}
            </p>
            <a
              href={`/${inv.invitation_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Xem Thiệp →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: "'Jost', sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    paddingBottom: '20px',
    borderBottom: '1px solid #ddd',
  },
  title: {
    fontSize: '32px',
    color: '#2c2420',
    margin: 0,
  },
  btn: {
    padding: '10px 20px',
    background: '#c8856a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s',
  },
  retryBtn: {
    padding: '12px 24px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '15px',
    fontWeight: 'bold',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '40px',
    background: '#f5f5f5',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  loadingText: {
    fontSize: '18px',
    color: '#666',
    margin: 0,
  },
  errorContainer: {
    background: '#ffebee',
    border: '2px solid #e07b6a',
    borderRadius: '12px',
    padding: '30px',
    marginBottom: '20px',
  },
  errorText: {
    fontSize: '18px',
    color: '#c62828',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
  },
  errorDetail: {
    fontSize: '14px',
    color: '#d32f2f',
    whiteSpace: 'pre-line',
    margin: '0 0 15px 0',
    lineHeight: '1.6',
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px 40px',
    background: '#f9f9f9',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  emptyText: {
    fontSize: '20px',
    color: '#999',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  link: {
    color: '#c8856a',
    textDecoration: 'none',
    fontWeight: 'bold',
    marginTop: '10px',
    display: 'inline-block',
  },
}

export default Dashboard
