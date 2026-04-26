// src/App.js
import React, { Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RuleProvider } from './context/RuleContext'
import { Layout } from './components/Layout'
import './index.css'

// 페이지 lazy load (default export)
const AuthPage          = React.lazy(() => import('./pages/AuthPage'))
const Dashboard         = React.lazy(() => import('./pages/Dashboard'))
const SchedulePage      = React.lazy(() => import('./pages/SchedulePage'))
const SettingsPage      = React.lazy(() => import('./pages/SettingsPage'))
const PublicProfilePage = React.lazy(() => import('./pages/PublicProfilePage'))
const PrivacyPage       = React.lazy(() => import('./pages/PrivacyPage'))
const AdminFeedbackPage      = React.lazy(() => import('./pages/AdminFeedbackPage'))
const SupportPage            = React.lazy(() => import('./pages/SupportPage'))
const AdminNoticePage        = React.lazy(() => import('./pages/AdminNoticePage'))
const AdminMembershipPage    = React.lazy(() => import('./pages/AdminMembershipPage'))
const AdminDataStatsPage     = React.lazy(() => import('./pages/AdminDataStatsPage'))
const NoticePage             = React.lazy(() => import('./pages/NoticePage'))
const NoticeListPage         = React.lazy(() => import('./pages/NoticeListPage'))
const NotificationCenterPage = React.lazy(() => import('./pages/NotificationCenterPage'))
const ResetPasswordPage      = React.lazy(() => import('./pages/ResetPasswordPage'))
const FAQPage                = React.lazy(() => import('./pages/FAQPage'))
const AdminFAQPage           = React.lazy(() => import('./pages/AdminFAQPage'))

// 페이지 lazy load (named export)
const AvailabilityPage = React.lazy(() => import('./pages/AvailabilityPage').then(m => ({ default: m.AvailabilityPage })))
const PlayLogPage      = React.lazy(() => import('./pages/PlayLogPage').then(m => ({ default: m.PlayLogPage })))
const RulebookPage     = React.lazy(() => import('./pages/RulebookPage').then(m => ({ default: m.RulebookPage })))
const ScenarioPage     = React.lazy(() => import('./pages/ScenarioPage').then(m => ({ default: m.ScenarioPage })))
const WishScenarioPage = React.lazy(() => import('./pages/WishScenarioPage').then(m => ({ default: m.WishScenarioPage })))
const DotoriPage       = React.lazy(() => import('./pages/DotoriPage').then(m => ({ default: m.DotoriPage })))
const PairsPage        = React.lazy(() => import('./pages/PairsPage').then(m => ({ default: m.PairsPage })))
const CharactersPage   = React.lazy(() => import('./pages/CharactersPage').then(m => ({ default: m.CharactersPage })))
const GuestbookPage    = React.lazy(() => import('./pages/GuestbookPage').then(m => ({ default: m.GuestbookPage })))
const BookmarkPage     = React.lazy(() => import('./pages/BookmarkPage').then(m => ({ default: m.BookmarkPage })))

const PageLoader = () => (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{textAlign:'center',color:'var(--color-text-light)',fontSize:'0.85rem'}}>
      <div style={{fontSize:'1.8rem',marginBottom:10}}>✦</div>불러오는 중...
    </div>
  </div>
)

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{textAlign:'center',maxWidth:480}}>
          <div style={{fontSize:'2rem',marginBottom:12}}>⚠️</div>
          <h2 style={{marginBottom:8,color:'#c62828'}}>페이지를 불러올 수 없어요</h2>
          <p style={{color:'#666',fontSize:'0.85rem',marginBottom:16}}>
            {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
          </p>
          <button onClick={()=>window.location.reload()}
            style={{padding:'8px 20px',borderRadius:8,border:'1px solid #ccc',cursor:'pointer',background:'white'}}>
            새로고침
          </button>
        </div>
      </div>
    )
    return this.props.children
  }
}

// vercel.app으로 접속 시 co.kr로 강제 리다이렉트
/*if (typeof window !== 'undefined' &&
    window.location.hostname.includes('vercel.app')) {
  window.location.replace(
    window.location.href.replace(
      window.location.hostname,
      'trpg-diary.co.kr'
    )
  )
}*/

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

function AppRoutes() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader/>}>
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
        <Route path="/wish-scenarios" element={<PrivateLayout><WishScenarioPage/></PrivateLayout>}/>
        <Route path="/dotori" element={<PrivateLayout><DotoriPage/></PrivateLayout>}/>
        <Route path="/pairs" element={<PrivateLayout><PairsPage/></PrivateLayout>}/>
        <Route path="/characters" element={<PrivateLayout><CharactersPage/></PrivateLayout>}/>
        <Route path="/bookmarks" element={<PrivateLayout><BookmarkPage/></PrivateLayout>}/>
        <Route path="/guestbook" element={<PrivateLayout><GuestbookPage/></PrivateLayout>}/>
        <Route path="/settings" element={<PrivateLayout><SettingsPage/></PrivateLayout>}/>
        <Route path="/admin/feedback" element={<PrivateLayout><AdminFeedbackPage/></PrivateLayout>}/>
        <Route path="/admin/notices" element={<PrivateLayout><AdminNoticePage/></PrivateLayout>}/>
        <Route path="/admin/membership" element={<PrivateLayout><AdminMembershipPage/></PrivateLayout>}/>
        <Route path="/admin/data-stats" element={<PrivateLayout><AdminDataStatsPage/></PrivateLayout>}/>
        <Route path="/notices" element={<PrivateLayout><NoticeListPage/></PrivateLayout>}/>
        <Route path="/notices/:id" element={<PrivateLayout><NoticePage/></PrivateLayout>}/>
        <Route path="/notifications" element={<PrivateLayout><NotificationCenterPage/></PrivateLayout>}/>
        <Route path="/support" element={<PrivateLayout><SupportPage/></PrivateLayout>}/>
        <Route path="/faq" element={<PrivateLayout><FAQPage/></PrivateLayout>}/>
        <Route path="/admin/faq" element={<PrivateLayout><AdminFAQPage/></PrivateLayout>}/>
        <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes/>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  )
}
