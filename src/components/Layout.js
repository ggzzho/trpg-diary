// src/components/Layout.js
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut, notificationsApi, supabase } from '../lib/supabase'
import { fmtAgo } from '../lib/dateFormatters'
import CursorEffect from './CursorEffect'

const NOTICE_VIEWED_KEY = 'noticeLastViewed'

const TIER_BADGE = {
  master: { label: '마스터', bg: '#7c5cbf', color: '#fff' },
  lv3:    { label: '♥♥♥',   bg: '#d4a017', color: '#fff' },
  lv2:    { label: '♥♥',    bg: '#9e9e9e', color: '#fff' },
  lv1:    { label: '♥',     bg: '#b87333', color: '#fff' },
}

const daysUntil = (iso) => {
  if (!iso) return null
  return Math.ceil((new Date(iso) - new Date()) / 86400000)
}

const fmtDateShort = (iso) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })
}

const NOTIF_ICON = {
  guestbook_comment: 'mail',
  guestbook_reply:   'subdirectory_arrow_right',
  feedback_comment:  'support_agent',
  feedback_reply:    'mark_email_read',
  inquiry_reply:     'mark_email_read',
}

const NAV_GROUPS = [
  { type:'item', to:'/dashboard', icon:'home', label:'Home' },
  { type:'group', key:'infor', label:'Infor', items:[
    { to:'/schedule', icon:'calendar_month', label:'일정 관리' },
    { to:'/rulebooks', icon:'menu_book', label:'보유 룰북' },
  ]},
  { type:'group', key:'scenario', label:'Scenario', items:[
    { to:'/scenarios', icon:'description', label:'보유 시나리오' },
    { to:'/wish-scenarios', icon:'favorite', label:'위시 시나리오' },
    { to:'/dotori', icon:'forest', label:'도토리' },
  ]},
  { type:'group', key:'sessions', label:'Sessions', items:[
    { to:'/availability', icon:'event_available', label:'공수표 목록' },
    { to:'/logs', icon:'auto_stories', label:'다녀온 기록' },
    { to:'/pairs', icon:'people', label:'페어/팀 목록' },
    { to:'/characters', icon:'person', label:'PC 목록' },
  ]},
  { type:'group', key:'etc', label:'ETC.', items:[
    { to:'/bookmarks', icon:'bookmark', label:'북마크' },
    { to:'/guestbook', icon:'mail', label:'방명록' },
  ]},
]

const STORAGE_KEY = 'nav_groups_open'

function loadGroupState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

function NavGroup({ group, pathname, badgeCounts = {} }) {
  const hasActive = group.items.some(i => pathname.startsWith(i.to))
  const [open, setOpen] = useState(() => {
    const s = loadGroupState()
    return s[group.key] !== undefined ? s[group.key] : true
  })

  // auto-open when a child becomes active
  useEffect(() => {
    if (hasActive && !open) setOpen(true)
  }, [hasActive]) // eslint-disable-line

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      const s = loadGroupState()
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, [group.key]: next }))
    } catch {}
  }

  return (
    <div>
      <button
        onClick={toggle}
        className={`nav-group-header${hasActive ? ' has-active' : ''}`}
      >
        <span className="nav-group-icon">
          <span className="ms">{open ? 'folder_open' : 'folder'}</span>
        </span>
        <span className="nav-group-label">{group.label}</span>
        <span className="ms nav-group-chevron" style={{fontSize:16,marginLeft:'auto',transition:'transform 0.2s',transform:open?'rotate(0deg)':'rotate(-90deg)'}}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="nav-group-children">
          {group.items.map(item => (
            <NavLink key={item.to} to={item.to} className={({isActive})=>`nav-item nav-child ${isActive?'active':''}`}>
              <span className="nav-icon"><span className="ms">{item.icon}</span></span>
              {item.label}
              {(badgeCounts[item.to] || 0) > 0 && (
                <span style={{
                  marginLeft:'auto', background:'var(--color-primary)', color:'white',
                  borderRadius:100, fontSize:'0.6rem', fontWeight:700,
                  padding:'1px 6px', minWidth:16, textAlign:'center', lineHeight:'16px',
                }}>
                  {badgeCounts[item.to]}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export const FOOTER_TEXT = '© 2026 TRPG Diary v2.0.1 · Made with Claude (AI). All rights reserved.'
export const SITE_VERSION = 'v2.0.1'

export function Layout({ children }) {
  const { user, profile, notifCounts, refreshNotifs } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const initial = profile?.display_name?.[0] || profile?.username?.[0] || '?'
  const isAdmin = profile?.is_admin === true
  const [kakaoPopup, setKakaoPopup] = useState(false)

  const badgeCounts = {
    '/guestbook':       notifCounts?.guestbook || 0,
    '/admin/feedback':  notifCounts?.feedback  || 0,
    '/support':         notifCounts?.inquiry   || 0,
  }

  // ── 벨 알림 드롭다운 ──────────────────────────────────────────
  const [bellOpen, setBellOpen] = useState(false)
  const [notifList, setNotifList] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const bellRef = useRef(null)

  const loadNotifs = useCallback(async () => {
    setNotifLoading(true)
    const list = await notificationsApi.getAll(20)
    setNotifList(list)
    setNotifLoading(false)
  }, [])

  useEffect(() => {
    if (bellOpen) loadNotifs()
  }, [bellOpen, loadNotifs])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    if (bellOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  const handleNotifClick = async (n) => {
    setBellOpen(false)
    if (!n.is_read) {
      await notificationsApi.markReadById(n.id)
      refreshNotifs()
    }
    const path = n.ref_url || (
      n.type === 'feedback_comment' || n.type === 'feedback_reply'
        ? '/admin/feedback'
        : n.type === 'inquiry_reply'
        ? '/support?tab=history'
        : '/guestbook'
    )
    navigate(path)
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifList(prev => prev.map(n => ({ ...n, is_read: true })))
    refreshNotifs()
  }

  // ── 공지사항 NEW 뱃지 ─────────────────────────────────────────
  const [noticeNew, setNoticeNew] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('notices').select('created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
      if (!data || data.length === 0) return
      const latestAt = new Date(data[0].created_at).getTime()
      const viewed = parseInt(localStorage.getItem(NOTICE_VIEWED_KEY) || '0', 10)
      setNoticeNew(latestAt > viewed)
    }
    check()
  }, [location.pathname])

  // /notices 방문 시 viewed 갱신
  useEffect(() => {
    if (location.pathname.startsWith('/notices')) {
      localStorage.setItem(NOTICE_VIEWED_KEY, Date.now().toString())
      setNoticeNew(false)
    }
  }, [location.pathname])

  const isLv2Plus = ['lv2','lv3','master'].includes(profile?.membership_tier)

  return (
    <div className="app-layout">
      {/* 후원자 lv2+ 커서 효과 (내 페이지) */}
      {isLv2Plus && profile?.cursor_effect && (
        <CursorEffect settings={profile.cursor_effect} />
      )}
      <div className={`sidebar-overlay ${mobileOpen?'open':''}`} onClick={()=>setMobileOpen(false)} />
      <button className="mobile-menu-btn" onClick={()=>setMobileOpen(!mobileOpen)}>
        {mobileOpen ? '✕' : '☰'}
      </button>
      <aside className={`sidebar ${mobileOpen?'open':''}`}>
        <div className="sidebar-brand">
          <h1>✦ TRPG Diary</h1>
          {profile?.username && <p>@{profile.username}</p>}
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map(item =>
            item.type === 'item'
              ? <NavLink key={item.to} to={item.to} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
                  <span className="nav-icon"><span className="ms">{item.icon}</span></span>{item.label}
                </NavLink>
              : <NavGroup key={item.key} group={item} pathname={location.pathname} badgeCounts={badgeCounts}/>
          )}

          <div style={{borderTop:'1px solid var(--color-border)',margin:'12px 0'}} />
          <NavLink to="/settings" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon"><span className="ms">settings</span></span>환경설정
          </NavLink>
          {profile&&(
            <a href={`/u/${profile.username}`} target="_blank" rel="noreferrer" className="nav-item">
              <span className="nav-icon"><span className="ms">open_in_new</span></span>내 공개 페이지
            </a>
          )}
          <NavLink to="/support" className={({isActive})=>`nav-item ${isActive?'active':''}`}
            style={{ marginTop:4 }}>
            <span className="nav-icon"><span className="ms">support_agent</span></span>문의하기
            {(notifCounts?.inquiry || 0) > 0 && (
              <span style={{
                marginLeft:'auto', background:'var(--color-primary)', color:'white',
                borderRadius:100, fontSize:'0.6rem', fontWeight:700,
                padding:'1px 6px', minWidth:16, textAlign:'center', lineHeight:'16px',
              }}>{notifCounts.inquiry}</span>
            )}
          </NavLink>
          <NavLink to="/notices" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon"><span className="ms">campaign</span></span>
            공지사항
            {noticeNew && (
              <span style={{
                marginLeft:'auto', background:'var(--color-primary)', color:'white',
                borderRadius:100, fontSize:'0.58rem', fontWeight:700,
                padding:'1px 6px', lineHeight:'16px',
              }}>N</span>
            )}
          </NavLink>

          {/* 관리자 전용 */}
          {isAdmin && (<>
            <div style={{borderTop:'1px solid var(--color-border)',margin:'8px 0',opacity:0.5}} />
            <NavGroup
              group={{
                key:'master',
                label:'Master',
                items:[
                  { to:'/admin/notices', icon:'campaign', label:'공지 관리' },
                  { to:'/admin/feedback', icon:'support_agent', label:'문의함' },
                  { to:'/admin/membership', icon:'workspace_premium', label:'멤버십 관리' },
                ]
              }}
              pathname={location.pathname}
              badgeCounts={badgeCounts}
            />
          </>)}
        </nav>
        {/* 알림 센터 벨 */}
        <div ref={bellRef} style={{ position:'relative', padding:'8px 12px 12px', marginTop:8 }}>
          <button
            onClick={() => setBellOpen(o => !o)}
            style={{
              width:'100%', display:'flex', alignItems:'center', gap:8,
              padding:'8px 10px', borderRadius:8, border:'1px solid var(--color-border)',
              background: bellOpen ? 'var(--color-nav-active-bg)' : 'transparent',
              cursor:'pointer', color:'var(--color-text)',
            }}
          >
            <span className="ms" style={{ fontSize:18 }}>notifications</span>
            <span style={{ fontSize:'0.83rem', flex:1, textAlign:'left' }}>알림</span>
            {(notifCounts?.total || 0) > 0 && (
              <span style={{
                background:'var(--color-primary)', color:'white',
                borderRadius:100, fontSize:'0.6rem', fontWeight:700,
                padding:'1px 7px', minWidth:18, textAlign:'center', lineHeight:'17px',
              }}>
                {notifCounts.total}
              </span>
            )}
          </button>

          {bellOpen && (
            <div style={{
              position:'absolute', bottom:'calc(100% + 4px)', left:12, right:12,
              background:'var(--color-surface)', border:'1px solid var(--color-border)',
              borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
              zIndex:200, overflow:'hidden', maxHeight:420,
              display:'flex', flexDirection:'column',
            }}>
              {/* 헤더 */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 14px', borderBottom:'1px solid var(--color-border)', flexShrink:0 }}>
                <span style={{ fontWeight:700, fontSize:'0.88rem' }}>알림</span>
                <div style={{ display:'flex', gap:6 }}>
                  <button
                    onClick={handleMarkAllRead}
                    style={{ fontSize:'0.72rem', color:'var(--color-text-light)',
                      background:'none', border:'none', cursor:'pointer', padding:'2px 4px' }}>
                    모두 읽음
                  </button>
                  <button
                    onClick={() => { setBellOpen(false); navigate('/notifications') }}
                    style={{ fontSize:'0.72rem', color:'var(--color-accent)',
                      background:'none', border:'none', cursor:'pointer', padding:'2px 4px' }}>
                    전체 보기
                  </button>
                </div>
              </div>

              {/* 목록 */}
              <div style={{ overflowY:'auto', flex:1 }}>
                {notifLoading
                  ? <div style={{ padding:20, textAlign:'center', fontSize:'0.8rem',
                      color:'var(--color-text-light)' }}>불러오는 중...</div>
                  : notifList.length === 0
                    ? <div style={{ padding:24, textAlign:'center', fontSize:'0.8rem',
                        color:'var(--color-text-light)' }}>알림이 없어요</div>
                    : notifList.map(n => (
                        <button key={n.id} onClick={() => handleNotifClick(n)}
                          style={{
                            width:'100%', display:'flex', alignItems:'flex-start', gap:10,
                            padding:'10px 14px', borderBottom:'1px solid var(--color-border)',
                            background: n.is_read ? 'transparent' : 'rgba(200,169,110,0.07)',
                            border:'none', cursor:'pointer', textAlign:'left',
                          }}>
                          <span className="ms" style={{
                            fontSize:18, flexShrink:0, marginTop:1,
                            color: n.is_read ? 'var(--color-text-light)' : 'var(--color-accent)',
                          }}>
                            {NOTIF_ICON[n.type] || 'notifications'}
                          </span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{
                              fontSize:'0.82rem', fontWeight: n.is_read ? 400 : 600,
                              color:'var(--color-text)',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            }}>
                              {n.message || n.type}
                            </div>
                            {n.preview && (
                              <div style={{
                                fontSize:'0.74rem', color:'var(--color-text-light)', marginTop:2,
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                              }}>
                                {n.preview}
                              </div>
                            )}
                            <div style={{ fontSize:'0.68rem', color:'var(--color-text-light)', marginTop:2, opacity:0.7 }}>
                              {fmtAgo(n.created_at)}
                            </div>
                          </div>
                          {!n.is_read && (
                            <div style={{
                              width:7, height:7, borderRadius:'50%',
                              background:'var(--color-primary)', flexShrink:0, marginTop:6,
                            }} />
                          )}
                        </button>
                      ))
                }
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="user-avatar">
              {profile?.avatar_url?<img src={profile.avatar_url} alt="avatar"/>:initial}
            </div>
            <div style={{overflow:'hidden'}}>
              <div className="user-name">{profile?.display_name||profile?.username}</div>
              <div className="text-xs text-light" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
            </div>
          </div>
          {/* 멤버십 정보 박스 (lv1~lv3) */}
          {['lv1','lv2','lv3'].includes(profile?.membership_tier) && (() => {
            const badge   = TIER_BADGE[profile.membership_tier]
            const days    = daysUntil(profile.membership_expires_at)
            const expired = days !== null && days < 0
            const urgent  = days !== null && days >= 0 && days <= 3
            return (
              <div style={{
                margin:'8px 0 6px',
                padding:'10px 12px',
                borderRadius:8,
                background:'var(--color-nav-active-bg)',
                border:`1px solid ${urgent||expired ? 'rgba(229,115,115,0.4)' : 'var(--color-border)'}`,
                fontSize:'0.75rem',
              }}>
                <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:5}}>
                  <span style={{padding:'1px 7px', borderRadius:100, fontSize:'0.65rem', fontWeight:700, background:badge.bg, color:badge.color}}>
                    {badge.label}
                  </span>
                  <span style={{fontWeight:600, color:'var(--color-text)', fontSize:'0.75rem'}}>후원 멤버십</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--color-text-light)', marginBottom:8}}>
                  <span>만료일 {fmtDateShort(profile.membership_expires_at)}</span>
                  {urgent && (
                    <span style={{padding:'1px 6px', borderRadius:100, fontSize:'0.65rem', fontWeight:700, background:'rgba(229,115,115,0.15)', color:'#e57373'}}>
                      만료 {days}일 전
                    </span>
                  )}
                  {expired && (
                    <span style={{padding:'1px 6px', borderRadius:100, fontSize:'0.65rem', fontWeight:700, background:'rgba(229,115,115,0.15)', color:'#e57373'}}>
                      만료됨
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-outline btn-sm w-full"
                  style={{justifyContent:'center', fontSize:'0.72rem'}}
                  onClick={() => navigate('/settings', { state:{ tab:'donation' } })}>
                  후원 정보 확인
                </button>
              </div>
            )
          })()}
          <button className="btn btn-ghost btn-sm w-full" style={{justifyContent:'center'}} onClick={handleSignOut}>로그아웃</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="fade-in">{children}</div>
        <footer style={{marginTop:60,paddingTop:20,borderTop:'1px solid var(--color-border)',textAlign:'center',color:'var(--color-text-light)',fontSize:'0.72rem'}}>
          <div style={{marginBottom:10, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
            <button
              onClick={() => {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                if (isMobile) window.open('https://qr.kakaopay.com/Ej8h4QBew', '_blank')
                else setKakaoPopup(true)
              }}
              style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:100,
                background:'rgba(255,235,0,0.12)',border:'1px solid rgba(255,235,0,0.4)',
                color:'#b8960c',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>
              💛 카카오페이로 후원하기
            </button>
            <a href="https://posty.pe/0k44m9" target="_blank" rel="noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:100,
                background:'rgba(200,169,110,0.08)',border:'1px solid var(--color-border)',
                color:'var(--color-accent)',textDecoration:'none',fontSize:'0.75rem',fontWeight:600}}>
              📖 사용설명서 바로가기
            </a>
          </div>

          {/* 카카오페이 PC 안내 팝업 */}
          {kakaoPopup && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
              onClick={() => setKakaoPopup(false)}>
              <div style={{background:'var(--color-surface)',borderRadius:16,padding:'28px 24px',maxWidth:300,width:'100%',textAlign:'center',border:'1px solid var(--color-border)'}}
                onClick={e => e.stopPropagation()}>
                <div style={{fontSize:'2rem',marginBottom:10}}>💛</div>
                <p style={{fontWeight:700,fontSize:'0.95rem',marginBottom:8,color:'var(--color-text)'}}>카카오페이 후원</p>
                <p style={{fontSize:'0.82rem',color:'var(--color-text-light)',lineHeight:1.7,marginBottom:16}}>
                  모바일 카메라로 QR을 스캔하거나<br/>모바일에서 접속해주세요!
                </p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://qr.kakaopay.com/Ej8h4QBew"
                  alt="카카오페이 QR" style={{width:140,height:140,borderRadius:8,marginBottom:16,border:'1px solid var(--color-border)'}}/>
                <button className="btn btn-outline btn-sm" style={{justifyContent:'center',width:'100%'}}
                  onClick={() => setKakaoPopup(false)}>닫기</button>
              </div>
            </div>
          )}
          <div style={{marginBottom:8}}>
            <a href="/privacy" style={{color:'var(--color-text-light)',textDecoration:'none',opacity:0.8}}
              onMouseOver={e=>e.target.style.opacity=1} onMouseOut={e=>e.target.style.opacity=0.8}>
              개인정보 처리방침
            </a>
          </div>
          {FOOTER_TEXT}
        </footer>
      </main>
    </div>
  )
}

export function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay">
      <div className="modal">
        {title&&<h2 className="modal-title">{title}</h2>}
        <form onSubmit={e=>e.preventDefault()}>
          {children}
        </form>
        {footer&&<div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function StarRating({ value, onChange, readOnly }) {
  return (
    <div className="stars" style={{fontSize:'1.2rem',cursor:readOnly?'default':'pointer'}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>!readOnly&&onChange&&onChange(n)} style={{opacity:n<=(value||0)?1:0.25}}>★</span>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, description, action }) {
  // icon이 Material Icon 이름(영문+밑줄)이면 Mi로 렌더링, 아니면 이모지
  const isMaterialIcon = icon && /^[a-z_]+$/.test(icon)
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {isMaterialIcon
          ? <span className="ms" style={{fontSize:48,color:'var(--color-accent)',opacity:0.4,fontVariationSettings:"'FILL' 0,'wght' 200,'GRAD' 0,'opsz' 48"}}>{icon}</span>
          : icon || '📭'
        }
      </div>
      <h3>{title||'아직 아무것도 없어요'}</h3>
      {description&&<p>{description}</p>}
      {action&&<div style={{marginTop:20}}>{action}</div>}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{display:'flex',justifyContent:'center',padding:60}}>
      <div style={{width:36,height:36,borderRadius:'50%',border:'3px solid var(--color-border)',borderTopColor:'var(--color-primary)',animation:'spin 0.8s linear infinite'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, message }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="삭제 확인"
      footer={<><button className="btn btn-outline btn-sm" onClick={onClose}>취소</button><button className="btn btn-danger btn-sm" onClick={()=>{onConfirm();onClose()}}>삭제</button></>}
    >
      <p style={{color:'var(--color-text-light)',fontSize:'0.88rem'}}>{message||'정말 삭제하시겠어요?'}</p>
    </Modal>
  )
}

export function TagManager({ tags, onAdd, onEdit, onRemove, placeholder, withColor = false }) {
  const [newTag, setNewTag] = React.useState('')
  const [newColor, setNewColor] = React.useState('')
  const [editingId, setEditingId] = React.useState(null)
  const [editValue, setEditValue] = React.useState('')
  const [editColor, setEditColor] = React.useState('')

  const handleAdd = () => {
    if (!newTag.trim()) return
    onAdd(newTag.trim(), withColor ? (newColor||null) : undefined)
    setNewTag(''); setNewColor('')
  }

  const handleSave = (tag) => {
    onEdit(tag.id, editValue, withColor ? (editColor||null) : undefined)
    setEditingId(null)
  }

  const ColorDot = ({ color, onChange, size=22 }) => (
    <label style={{position:'relative',flexShrink:0,cursor:'pointer'}} title="색 선택">
      <div style={{
        width:size, height:size, borderRadius:'50%', flexShrink:0,
        background: color || 'var(--color-surface)',
        border: color ? `2px solid ${color}` : '2px dashed var(--color-border)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {!color && <span style={{fontSize:10, color:'var(--color-text-light)', lineHeight:1}}>+</span>}
      </div>
      <input type="color" value={color||'#888888'} onChange={e=>onChange(e.target.value)}
        style={{position:'absolute',opacity:0,width:0,height:0,pointerEvents:'none'}}/>
    </label>
  )

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
        {withColor && <ColorDot color={newColor} onChange={setNewColor}/>}
        <input className="form-input" placeholder={placeholder||'태그 이름...'} value={newTag}
          onChange={e=>setNewTag(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleAdd()}
          style={{flex:1}} />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>추가</button>
      </div>
      {tags.length===0
        ?<div className="text-sm text-light" style={{textAlign:'center',padding:'12px 0'}}>아직 태그가 없어요</div>
        :<div style={{display:'flex',flexDirection:'column',gap:6}}>
          {tags.map(tag=>(
            <div key={tag.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderRadius:8,background:'var(--color-nav-active-bg)',border:'1px solid var(--color-border)',gap:8}}>
              {withColor && (
                editingId===tag.id
                  ? <ColorDot color={editColor} onChange={setEditColor}/>
                  : <div style={{width:16,height:16,borderRadius:'50%',flexShrink:0,background:tag.color||'var(--color-surface)',border:tag.color?`2px solid ${tag.color}`:'2px dashed var(--color-border)'}}/>
              )}
              {editingId===tag.id
                ?<input className="form-input" value={editValue} onChange={e=>setEditValue(e.target.value)}
                  style={{flex:1,marginRight:8,fontSize:'0.85rem'}} autoFocus
                  onKeyDown={e=>{if(e.key==='Enter')handleSave(tag);if(e.key==='Escape')setEditingId(null)}} />
                :<span style={{fontSize:'0.88rem',flex:1}}>{tag.name}</span>
              }
              <div className="flex gap-6">
                {editingId===tag.id
                  ?<><button className="btn btn-primary btn-sm" style={{padding:'2px 8px'}} onClick={()=>handleSave(tag)}>저장</button><button className="btn btn-ghost btn-sm" style={{padding:'2px 6px'}} onClick={()=>setEditingId(null)}>취소</button></>
                  :<><button className="btn btn-ghost btn-sm" style={{padding:'2px 8px'}} onClick={()=>{setEditingId(tag.id);setEditValue(tag.name);setEditColor(tag.color||'')}}>수정</button><button className="btn btn-ghost btn-sm" style={{color:'#e57373',padding:'2px 8px'}} onClick={()=>onRemove(tag.id)}>삭제</button></>
                }
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}

// ── 공통 페이지네이션 컴포넌트 ──
export function Pagination({ total, perPage, page, onPage, onPerPage, options = [10, 20, 30] }) {
  const totalPages = Math.ceil(total / perPage)
  if (total === 0) return null
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      flexWrap:'wrap', gap:8, marginTop:16, paddingTop:12, borderTop:'1px solid var(--color-border)' }}>
      {/* 페이지 번호 - 중앙 */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', gap:4, alignItems:'center' }}>
        {totalPages > 1 && <>
          <button className="btn btn-ghost btn-sm"
            onClick={() => onPage(p => Math.max(1, p-1))} disabled={page===1}>
            <span className="ms" style={{fontSize:16}}>chevron_left</span>
          </button>
          {Array.from({ length: totalPages }, (_,i) => i+1)
            .filter(n => n===1 || n===totalPages || Math.abs(n-page)<=1)
            .reduce((acc,n,i,arr) => {
              if (i>0 && n-arr[i-1]>1) acc.push('...')
              acc.push(n)
              return acc
            }, [])
            .map((n,i) => n==='...'
              ? <span key={`e${i}`} style={{ padding:'0 4px', color:'var(--color-text-light)', fontSize:'0.8rem' }}>…</span>
              : <button key={n}
                  className={`btn btn-sm ${page===n?'btn-primary':'btn-outline'}`}
                  onClick={() => onPage(n)}
                  style={{ minWidth:32, padding:'3px 6px', fontSize:'0.78rem', justifyContent:'center' }}>
                  {n}
                </button>
            )}
          <button className="btn btn-ghost btn-sm"
            onClick={() => onPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>
            <span className="ms" style={{fontSize:16}}>chevron_right</span>
          </button>
        </>}
      </div>
      {/* 개수 선택 - 우측 */}
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        {options.map(n => (
          <button key={n}
            className={`btn btn-sm ${perPage===n?'btn-primary':'btn-outline'}`}
            onClick={() => { onPerPage(n); onPage(1) }}
            style={{ fontSize:'0.72rem', padding:'3px 10px' }}>
            {n}개
          </button>
        ))}
      </div>
    </div>
  )
}
