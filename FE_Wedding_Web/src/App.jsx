import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import Pricing from './pages/Pricing'
import Profile from './pages/Profile'
import PaymentSuccess from './pages/PaymentSuccess'
import TemplateLoader from './components/TemplateLoader'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import InvitationsPage from './pages/dashboard/InvitationsPage'
import TemplatesPage from './pages/dashboard/TemplatesPage'
import InvitePage from './pages/dashboard/InvitePage'
import GuestsPage from './pages/dashboard/GuestsPage'
import CheckinsPage from './pages/dashboard/CheckinsPage'
import EditorPage from './pages/dashboard/EditorPage'
import TemplatePreviewPage from './pages/dashboard/TemplatePreviewPage'
import AdminPage from './pages/admin/AdminPage'
import CtvDashboard from './pages/ctv/CtvDashboard'
import PayPage from './pages/PayPage'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if token exists on mount
    const savedToken = localStorage.getItem('token')
    setToken(savedToken)
    setIsLoading(false)
  }, [])

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public payment page - no auth required */}
        <Route path="/pay/:token" element={<PayPage />} />

        {/* Public template route - no auth required */}
        <Route path="/:slug" element={<TemplateLoader />} />

        {/* Auth routes */}
        <Route
          path="/auth"
          element={token ? <Navigate to="/" /> : <Auth onLogin={handleLogin} />}
        />
        <Route
          path="/login"
          element={token ? <Navigate to="/" /> : <Auth onLogin={handleLogin} />}
        />

        {/* Protected routes - require auth */}
        <Route
          path="/"
          element={token ? <Navigate to="/dashboard" /> : <Navigate to="/auth" />}
        />
        <Route
          path="/dashboard"
          element={
            token ? <DashboardLayout onLogout={handleLogout} /> : <Navigate to="/auth" />
          }
        >
          <Route index element={<InvitationsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="invite" element={<InvitePage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="checkins" element={<CheckinsPage />} />
        </Route>
        <Route
          path="/editor/:invitationId"
          element={token ? <EditorPage /> : <Navigate to="/auth" />}
        />
        <Route
          path="/preview/:templateId"
          element={token ? <TemplatePreviewPage /> : <Navigate to="/auth" />}
        />
        <Route
          path="/pricing"
          element={token ? <Pricing /> : <Navigate to="/auth" />}
        />
        <Route
          path="/profile"
          element={token ? <Profile /> : <Navigate to="/auth" />}
        />
        <Route
          path="/admin"
          element={token ? <AdminPage /> : <Navigate to="/auth" />}
        />
        <Route
          path="/ctv"
          element={token ? <CtvDashboard /> : <Navigate to="/auth" />}
        />
        <Route
          path="/payment-success"
          element={token ? <PaymentSuccess /> : <Navigate to="/auth" />}
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
