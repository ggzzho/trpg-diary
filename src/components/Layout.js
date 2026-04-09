// src/components/Layout.js
import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../lib/supabase'

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

export const FOOTER_TEXT = '© 2026 TRPG Diary v1.1.0 · Made with Claude (AI). All rights reserved.'
export const SITE_VERSION = 'v1.1.0'

export function Layout({ children }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const initial = profile?.display_name?.[0] || profile?.username?.[0] || '?'
  const isAdmin = profile?.is_admin === true
  const [kakaoPopup, setKakaoPopup] = useState(false)

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

          {/* 관리자 전용 */}
          {isAdmin && (<>
            <div style={{borderTop:'1px solid var(--color-border)',margin:'8px 0',opacity:0.5}} />
            <NavLink to="/admin/notices" className={({isActive})=>`nav-item ${isActive?'active':''}`}
              style={{color:'var(--color-accent)'}}>
              <span className="nav-icon"><span className="ms">campaign</span></span>공지사항 관리
            </NavLink>
            <NavLink to="/admin/feedback" className={({isActive})=>`nav-item ${isActive?'active':''}`}
              style={{color:'var(--color-accent)'}}>
              <span className="nav-icon"><span className="ms">support_agent</span></span>문의함
            </NavLink>
          </>)}

          <div style={{borderTop:'1px solid var(--color-border)',margin:'12px 0'}} />
          <NavLink to="/settings" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon"><span className="ms">settings</span></span>환경설정
          </NavLink>
          {profile&&(
            <a href={`/u/${profile.username}`} target="_blank" rel="noreferrer" className="nav-item">
              <span className="nav-icon"><span className="ms">open_in_new</span></span>내 공개 페이지
            </a>
          )}
          <a href="https://trpg-diary.co.kr/u/trpg00_Z?tab=feedback" target="_blank" rel="noreferrer" className="nav-item"
            style={{ marginTop:4 }}>
            <span className="nav-icon"><span className="ms">support_agent</span></span>문의하기
          </a>
          <NavLink to="/notices" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon"><span className="ms">campaign</span></span>공지사항
          </NavLink>
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
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
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
