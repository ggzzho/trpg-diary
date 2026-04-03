// src/components/Layout.js
import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/dashboard', icon: '🏠', label: '홈' },
  { to: '/schedule', icon: '📅', label: '일정 관리' },
  { to: '/availability', icon: '📋', label: '공수표 목록' },
  { to: '/logs', icon: '📖', label: '다녀온 기록' },
  { to: '/rulebooks', icon: '📚', label: '보유 룰북' },
  { to: '/scenarios', icon: '🗺️', label: '시나리오 목록' },
  { to: '/pairs', icon: '👥', label: '페어 목록' },
  { to: '/bookmarks', icon: '🔖', label: '북마크' },
  { to: '/guestbook', icon: '💌', label: '방명록' },
]

export function Layout({ children }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const initial = profile?.display_name?.[0] || profile?.username?.[0] || '?'

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="메뉴 열기">
        {mobileOpen ? '✕' : '☰'}
      </button>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>✦ TRPG Diary</h1>
          {profile?.username && <p>@{profile.username}</p>}
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0' }} />
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span>환경설정
          </NavLink>
          {profile && (
            <a href={`/u/${profile.username}`} target="_blank" rel="noreferrer" className="nav-item">
              <span className="nav-icon">🔗</span>내 공개 페이지
            </a>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="user-avatar">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" /> : initial}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div className="user-name">{profile?.display_name || profile?.username}</div>
              <div className="text-xs text-light" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm w-full" style={{ justifyContent:'center' }} onClick={handleSignOut}>로그아웃</button>
        </div>
      </aside>
      <main className="main-content fade-in">{children}</main>
    </div>
  )
}

export function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {title && <h2 className="modal-title">{title}</h2>}
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function StarRating({ value, onChange, readOnly }) {
  return (
    <div className="stars" style={{ fontSize: '1.2rem', cursor: readOnly ? 'default' : 'pointer' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => !readOnly && onChange && onChange(n)} style={{ opacity: n <= (value || 0) ? 1 : 0.25 }}>★</span>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon || '📭'}</div>
      <h3>{title || '아직 아무것도 없어요'}</h3>
      <p>{description || '새로운 항목을 추가해보세요!'}</p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid var(--color-border)', borderTopColor:'var(--color-primary)', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, message }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="삭제 확인"
      footer={<><button className="btn btn-outline btn-sm" onClick={onClose}>취소</button><button className="btn btn-danger btn-sm" onClick={() => { onConfirm(); onClose(); }}>삭제</button></>}
    >
      <p style={{ color: 'var(--color-text-light)', fontSize: '0.88rem' }}>{message || '정말 삭제하시겠어요?'}</p>
    </Modal>
  )
}
