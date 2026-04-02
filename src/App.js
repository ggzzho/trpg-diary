// src/App.js
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RuleProvider } from './context/RuleContext'
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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', color:'var(--color-text-light)', fontSize:'0.85rem' }}>
        <div style={{ fontSize:'1.8rem', marginBottom:10 }}>✦</div>
        불러오는 중...
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PrivateLayout({ children }) {
  return (
    <PrivateRoute>
      <ThemeProvider>
        <RuleProvider>
          <Layout>{children}</Layout>
        </RuleProvider>
      </ThemeProvider>
    </PrivateRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/u/:username" element={<PublicProfilePage />} />
      <Route path="/dashboard" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/schedule" element={<PrivateLayout><SchedulePage /></PrivateLayout>} />
      <Route path="/availability" element={<PrivateLayout><AvailabilityPage /></PrivateLayout>} />
      <Route path="/logs" element={<PrivateLayout><PlayLogPage /></PrivateLayout>} />
      <Route path="/rulebooks" element={<PrivateLayout><RulebookPage /></PrivateLayout>} />
      <Route path="/scenarios" element={<PrivateLayout><ScenarioPage /></PrivateLayout>} />
      <Route path="/pairs" element={<PrivateLayout><PairsPage /></PrivateLayout>} />
      <Route path="/guestbook" element={<PrivateLayout><GuestbookPage /></PrivateLayout>} />
      <Route path="/settings" element={<PrivateLayout><SettingsPage /></PrivateLayout>} />
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
