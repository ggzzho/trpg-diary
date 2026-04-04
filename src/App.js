// src/App.js
import React, { useEffect } from 'react'
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
import { BookmarkPage } from './pages/BookmarkPage'
import SettingsPage from './pages/SettingsPage'
import PublicProfilePage from './pages/PublicProfilePage'
import PrivacyPage from './pages/PrivacyPage'
import AdminFeedbackPage from './pages/AdminFeedbackPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import './index.css'

// vercel.app으로 접속 시 co.kr로 강제 리다이렉트
if (typeof window !== 'undefined' &&
    window.location.hostname.includes('vercel.app')) {
  window.location.replace(
    window.location.href.replace(
      window.location.hostname,
      'trpg-diary.co.kr'
    )
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',color:'var(--color-text-light)',fontSize:'0.85rem'}}>
        <div style={{fontSize:'1.8rem',marginBottom:10}}>✦</div>불러오는 중...
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace/>
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

// 비밀번호 재설정 페이지
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage/>}/>
      <Route path="/u/:username" element={<PublicProfilePage/>}/>
      <Route path="/privacy" element={<PrivacyPage/>}/>
      <Route path="/reset-password" element={<ResetPasswordPage/>}/>
      <Route path="/dashboard" element={<PrivateLayout><Dashboard/></PrivateLayout>}/>
      <Route path="/schedule" element={<PrivateLayout><SchedulePage/></PrivateLayout>}/>
      <Route path="/availability" element={<PrivateLayout><AvailabilityPage/></PrivateLayout>}/>
      <Route path="/logs" element={<PrivateLayout><PlayLogPage/></PrivateLayout>}/>
      <Route path="/rulebooks" element={<PrivateLayout><RulebookPage/></PrivateLayout>}/>
      <Route path="/scenarios" element={<PrivateLayout><ScenarioPage/></PrivateLayout>}/>
      <Route path="/pairs" element={<PrivateLayout><PairsPage/></PrivateLayout>}/>
      <Route path="/bookmarks" element={<PrivateLayout><BookmarkPage/></PrivateLayout>}/>
      <Route path="/guestbook" element={<PrivateLayout><GuestbookPage/></PrivateLayout>}/>
      <Route path="/settings" element={<PrivateLayout><SettingsPage/></PrivateLayout>}/>
      <Route path="/admin/feedback" element={<PrivateLayout><AdminFeedbackPage/></PrivateLayout>}/>
      <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes/>
      </AuthProvider>
    </BrowserRouter>
  )
}
