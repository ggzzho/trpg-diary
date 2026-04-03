// src/components/Layout.js
import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../lib/supabase'

// 시나리오 아이콘: 📋 (클립보드/목록 느낌)

const NAV_ITEMS = [
  { to:'/dashboard', icon:'home', label:'홈' },
  { to:'/schedule', icon:'calendar_month', label:'일정 관리' },
  { to:'/rulebooks', icon:'menu_book', label:'보유 룰북' },
  { to:'/logs', icon:'auto_stories', label:'다녀온 기록' },
  { to:'/availability', icon:'event_available', label:'공수표 목록' },
  { to:'/scenarios', icon:'description', label:'시나리오 목록' },
  { to:'/pairs', icon:'people', label:'페어 목록' },
  { to:'/bookmarks', icon:'bookmark', label:'북마크' },
  { to:'/guestbook', icon:'mail', label:'방명록' },
]

export const FOOTER_TEXT = '© 2026 TRPG Diary. Made with Claude (AI). All rights reserved.'

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
          {NAV_ITEMS.map(item=>(
            <NavLink key={item.to} to={item.to} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
              <span className="nav-icon"><span className="ms">{item.icon}</span></span>{item.label}
            </NavLink>
          ))}
          <div style={{borderTop:'1px solid var(--color-border)',margin:'12px 0'}} />
          <NavLink to="/settings" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon"><span className="ms">settings</span></span>환경설정
          </NavLink>
          {profile&&(
            <a href={`/u/${profile.username}`} target="_blank" rel="noreferrer" className="nav-item">
              <span className="nav-icon"><span className="ms">open_in_new</span></span>내 공개 페이지
            </a>
          )}
        </nav>
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
          <button className="btn btn-ghost btn-sm w-full" style={{justifyContent:'center'}} onClick={handleSignOut}>로그아웃</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="fade-in">{children}</div>
        <footer style={{marginTop:60,paddingTop:20,borderTop:'1px solid var(--color-border)',textAlign:'center',color:'var(--color-text-light)',fontSize:'0.72rem'}}>
          {FOOTER_TEXT}
        </footer>
      </main>
    </div>
  )
}

export function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        {title&&<h2 className="modal-title">{title}</h2>}
        {children}
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

export function TagManager({ tags, onAdd, onEdit, onRemove, placeholder }) {
  const [newTag, setNewTag] = React.useState('')
  const [editingId, setEditingId] = React.useState(null)
  const [editValue, setEditValue] = React.useState('')
  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input className="form-input" placeholder={placeholder||'태그 이름...'} value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&newTag.trim()&&(onAdd(newTag.trim()),setNewTag(''))} style={{flex:1}} />
        <button className="btn btn-primary btn-sm" onClick={()=>{if(newTag.trim()){onAdd(newTag.trim());setNewTag('')}}}>추가</button>
      </div>
      {tags.length===0
        ?<div className="text-sm text-light" style={{textAlign:'center',padding:'12px 0'}}>아직 태그가 없어요</div>
        :<div style={{display:'flex',flexDirection:'column',gap:6}}>
          {tags.map(tag=>(
            <div key={tag.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderRadius:8,background:'var(--color-nav-active-bg)',border:'1px solid var(--color-border)'}}>
              {editingId===tag.id
                ?<input className="form-input" value={editValue} onChange={e=>setEditValue(e.target.value)} style={{flex:1,marginRight:8,fontSize:'0.85rem'}} autoFocus onKeyDown={e=>{if(e.key==='Enter'){onEdit(tag.id,editValue);setEditingId(null)}if(e.key==='Escape')setEditingId(null)}} />
                :<span style={{fontSize:'0.88rem',flex:1}}>{tag.name}</span>
              }
              <div className="flex gap-6">
                {editingId===tag.id
                  ?<><button className="btn btn-primary btn-sm" style={{padding:'2px 8px'}} onClick={()=>{onEdit(tag.id,editValue);setEditingId(null)}}>저장</button><button className="btn btn-ghost btn-sm" style={{padding:'2px 6px'}} onClick={()=>setEditingId(null)}>취소</button></>
                  :<><button className="btn btn-ghost btn-sm" style={{padding:'2px 8px'}} onClick={()=>{setEditingId(tag.id);setEditValue(tag.name)}}>수정</button><button className="btn btn-ghost btn-sm" style={{color:'#e57373',padding:'2px 8px'}} onClick={()=>onRemove(tag.id)}>삭제</button></>
                }
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}
