// src/App.js
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import SchedulePage from './pages/SchedulePage'
import { AvailabilityPage } from './pages/AvailabilityPage'
import { PlayLogPage } from './pages/PlayLogPage'
import { RulebookPage } from './pages/RulebookPage'
import { ScenarioPage } from './pages/ScenarioPage'
import { PairsPage } from './pages/PairsPage'
import { GuestbookPage } from './pages/GuestbookPage'
import SettingsPage from './pages/SettingsPage'
import PublicProfilePage from './pages/PublicProfilePage'
import './index.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--color-text-light)', fontFamily: 'var(--font-serif)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>✦</div>
        불러오는 중...
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/u/:username" element={<PublicProfilePage />} />

      {/* 비공개 (로그인 필요) */}
      <Route path="/dashboard" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><Dashboard /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/schedule" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><SchedulePage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/availability" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><AvailabilityPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/logs" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><PlayLogPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/rulebooks" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><RulebookPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/scenarios" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><ScenarioPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/pairs" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><PairsPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/guestbook" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><GuestbookPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute>
          <ThemeProvider>
            <Layout><SettingsPage /></Layout>
          </ThemeProvider>
        </PrivateRoute>
      } />

      {/* 기본 리다이렉트 */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
