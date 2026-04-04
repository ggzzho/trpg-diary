// src/pages/GuestbookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mi } from '../components/Mi'
import { supabase } from '../lib/supabase'

const fmtDT = (d) => {
  const dt = new Date(d)
  const date = dt.toLocaleDateString('ko-KR', { year:'2-digit', month:'numeric', day:'numeric' })
  const time = dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
  return `${date} ${time}`
}

// content에서 url과 메모 파싱 (공통 유틸)
const parseEntry = (g) => {
  const raw = g.content || ''
  if (raw.includes('|||')) {
    const idx = raw.indexOf('|||')
    return { url: raw.slice(0, idx), memo: raw.slice(idx + 3) }
  }
  return { url: raw, memo: '' }
}

// 친구 페이지 칩 컴포넌트
function FriendChip({ g, isOwner, userId, onEdit, onRemove }) {
  const { url, memo } = parseEntry(g)
  const href = url?.startsWith('http') ? url : g.author_username ? `/u/${g.author_username}` : '#'

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:'var(--color-surface)', border:'1px solid var(--color-border)', transition:'box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
    >
      {/* 아바타 */}
      <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration:'none', flexShrink:0 }}>
        <div style={{ width:42, height:42, borderRadius:'50%', overflow:'hidden', background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', color:'white', fontWeight:700 }}>
          {g.author_avatar_url
            ? <img src={g.author_avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.style.display='none' }}/>
            : (g.author_name||'?')[0]
          }
        </div>
      </a>

      {/* 이름 + 메모 */}
      <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
          <a href={href} target="_blank" rel="noreferrer"
            style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--color-text)', textDecoration:'none', wordBreak:'break-all' }}
            onMouseEnter={e => e.target.style.color='var(--color-primary)'}
            onMouseLeave={e => e.target.style.color='var(--color-text)'}
          >
            {g.author_name}
          </a>
          {g.author_username && (
            <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', whiteSpace:'nowrap' }}>@{g.author_username}</span>
          )}
        </div>
        {/* 메모 박스 */}
        {memo && (
          <div style={{
            marginTop: 5,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--color-nav-active-bg)',
            border: '1px solid var(--color-border)',
            fontSize: '0.78rem',
            color: 'var(--color-text-light)',
            lineHeight: 1.5,
            wordBreak: 'break-all',
          }}>
            <Mi size="sm" color="accent" style={{ marginRight:4, verticalAlign:'middle' }}>edit_note</Mi>
            {memo}
          </div>
        )}
      </div>

      {/* 편집 버튼 */}
      {(isOwner || (userId && g.author_id === userId)) && (
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          {isOwner && (
            <button className="btn btn-ghost btn-sm" style={{ padding:'4px 7px' }}
              onClick={() => onEdit(g)} title="수정">
              <Mi size="sm" color="light">edit</Mi>
            </button>
          )}
          <button className="btn btn-ghost btn-sm" style={{ padding:'4px 7px', color:'#e57373' }}
            onClick={() => onRemove(g.id)} title="삭제">
            <Mi size="sm" color="danger">close</Mi>
          </button>
        </div>
      )}
    </div>
  )
}

// ── 공개 페이지용 ──
export function GuestbookPublicView({ ownerId }) {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('message')
  const [messages, setMessages] = useState([])
  const [mypages, setMypages] = useState([])
  const [loading, setLoading] = useState(true)

  const [msgForm, setMsgForm] = useState({ content:'', is_private:false })
  const [msgSubmitting, setMsgSubmitting] = useState(false)
  const [msgDone, setMsgDone] = useState(false)

  const [pageFormOpen, setPageFormOpen] = useState(false)
  const [pageForm, setPageForm] = useState({ nickname:'', url:'', avatar_url:'' })
  const [pageSubmitting, setPageSubmitting] = useState(false)
  const [pageDone, setPageDone] = useState(false)

  // 수정 모달
  const [editingItem, setEditingItem] = useState(null) // {id, nickname, memo}
  const [editForm, setEditForm] = useState({ nickname:'', memo:'' })

  const isOwner = !!(user && ownerId && user.id === ownerId)

  const load = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data: all } = await supabase
      .from('guestbook').select('*').eq('owner_id', ownerId)
      .order('created_at', { ascending:false })
    setMessages((all||[]).filter(g => g.type==='message' || !g.type))
    setMypages((all||[]).filter(g => g.type==='mypage'))
    setLoading(false)
  }
  useEffect(() => { load() }, [ownerId, user])

  const submitMsg = async () => {
    if (!msgForm.content.trim()) return
    setMsgSubmitting(true)
    await supabase.from('guestbook').insert({
      owner_id:ownerId, author_id:user?.id||null,
      author_name: profile?.display_name || profile?.username || '익명',
      content:msgForm.content.trim(), is_private:msgForm.is_private, type:'message',
    })
    setMsgForm({ content:'', is_private:false })
    setMsgDone(true); setTimeout(() => setMsgDone(false), 2500)
    load(); setMsgSubmitting(false)
  }

  const submitPage = async () => {
    if (!pageForm.nickname.trim() || !pageForm.url.trim()) { alert('닉네임과 URL은 필수예요!'); return }
    const m = pageForm.url.match(/\/u\/([^/?#\s]+)/)
    setPageSubmitting(true)
    await supabase.from('guestbook').insert({
      owner_id:ownerId, author_id:user?.id||null,
      author_name:pageForm.nickname.trim(),
      author_username:m ? m[1] : null,
      author_avatar_url:pageForm.avatar_url.trim() || null,
      content:pageForm.url.trim(),
      type:'mypage',
    })
    setPageForm({ nickname:'', url:'', avatar_url:'' })
    setPageFormOpen(false)
    setPageDone(true); setTimeout(() => setPageDone(false), 3000)
    load(); setPageSubmitting(false)
  }

  const removeEntry = async (id) => {
    await supabase.from('guestbook').delete().eq('id', id); load()
  }

  const openEdit = (g) => {
    const { memo } = parseEntry(g)
    setEditingItem(g)
    setEditForm({ nickname: g.author_name || '', memo })
  }

  const saveEdit = async () => {
    if (!editingItem) return
    const { url } = parseEntry(editingItem) // 기존 URL만 추출
    const newContent = editForm.memo.trim()
      ? `${url}|||${editForm.memo.trim()}`
      : url
    await supabase.from('guestbook').update({
      author_name: editForm.nickname.trim(),
      content: newContent,
    }).eq('id', editingItem.id)
    setEditingItem(null)
    load()
  }

  return (
    <div>
      {/* 수정 모달 */}
      {editingItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setEditingItem(null) }}>
          <div style={{ background:'var(--color-surface)', borderRadius:12, padding:24, width:'100%', maxWidth:380, boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:16 }}>친구 페이지 수정</div>
            <div className="form-group">
              <label className="form-label">닉네임</label>
              <input className="form-input" autoComplete="off" value={editForm.nickname}
                onChange={e => setEditForm(f => ({...f, nickname:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">메모</label>
              <textarea className="form-textarea" autoComplete="off"
                placeholder="이 친구에 대한 메모를 남겨요..." rows={3}
                value={editForm.memo} onChange={e => setEditForm(f => ({...f, memo:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => setEditingItem(null)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-8" style={{ marginBottom:20 }}>
        <button className={`btn btn-sm ${tab==='message'?'btn-primary':'btn-outline'}`} onClick={() => setTab('message')}
          style={{ display:'flex', alignItems:'center', gap:4 }}>
          <Mi size="sm" color={tab==='message'?'white':'accent'}>mail</Mi>
          방명록 ({messages.length})
        </button>
        <button className={`btn btn-sm ${tab==='mypage'?'btn-primary':'btn-outline'}`} onClick={() => setTab('mypage')}
          style={{ display:'flex', alignItems:'center', gap:4 }}>
          <Mi size="sm" color={tab==='mypage'?'white':'accent'}>link</Mi>
          친구 페이지 목록 ({mypages.length})
        </button>
      </div>

      {/* ── 방명록 ── */}
      {tab === 'message' && (
        <div>
          <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
            <textarea className="form-textarea" placeholder="방명록을 남겨보세요 💌" autoComplete="off"
              value={msgForm.content} onChange={e => setMsgForm(f => ({...f, content:e.target.value}))}
              style={{ minHeight:80, marginBottom:10 }}/>
            <div className="flex justify-between items-center">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'var(--color-text-light)', cursor:'pointer' }}>
                <input type="checkbox" checked={msgForm.is_private} onChange={e => setMsgForm(f => ({...f, is_private:e.target.checked}))}/>
                🔒 비공개
              </label>
              <div className="flex items-center gap-10">
                {msgDone && <span className="text-sm" style={{ color:'#558b2f' }}>✅ 남겼어요!</span>}
                <button className="btn btn-primary btn-sm" onClick={submitMsg} disabled={msgSubmitting || !msgForm.content.trim()}>
                  {msgSubmitting ? '저장 중...' : '방명록 남기기'}
                </button>
              </div>
            </div>
          </div>
          {loading
            ? <div className="text-sm text-light" style={{ textAlign:'center', padding:20 }}>불러오는 중...</div>
            : messages.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:32, color:'var(--color-text-light)', fontSize:'0.85rem' }}>아직 방명록이 없어요</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {messages.map(g => {
                    const hidden = g.is_private && !isOwner && g.author_id !== user?.id
                    return (
                      <div key={g.id} className="card" style={{ padding:'14px 20px' }}>
                        <div className="flex justify-between items-start" style={{ marginBottom:8 }}>
                          <div className="flex items-center gap-8">
                            <span style={{ fontWeight:600, fontSize:'0.88rem' }}>{g.author_name || '익명'}</span>
                            {g.is_private && <span className="badge badge-gray" style={{ fontSize:'0.62rem' }}>🔒 비공개</span>}
                          </div>
                          <div className="flex items-center gap-8">
                            <span className="text-xs text-light">{fmtDT(g.created_at)}</span>
                            {(isOwner || g.author_id === user?.id) && (
                              <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'1px 6px' }}
                                onClick={() => removeEntry(g.id)}>삭제</button>
                            )}
                          </div>
                        </div>
                        <p style={{ fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                          {hidden ? '🔒 비공개 메시지예요' : g.content}
                        </p>
                      </div>
                    )
                  })}
                </div>
          }
        </div>
      )}

      {/* ── 친구 페이지 목록 ── */}
      {tab === 'mypage' && (
        <div>
          {/* 방문자 입력 폼 - 항상 표시 */}
          <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: pageFormOpen ? 14 : 0 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:2, display:'flex', alignItems:'center', gap:5 }}>
                  <Mi size="sm">link</Mi>내 페이지 남기기
                </div>
                <div className="text-xs text-light">내 공개 페이지 링크를 이곳에 남겨요</div>
              </div>
              <div className="flex items-center gap-8">
                {pageDone && <span className="text-sm" style={{ color:'#558b2f' }}>✅ 남겼어요!</span>}
                <button className={`btn btn-sm ${pageFormOpen ? 'btn-outline' : 'btn-primary'}`}
                  onClick={() => setPageFormOpen(v => !v)}>
                  {pageFormOpen ? '접기' : '+ 남기기'}
                </button>
              </div>
            </div>
            {pageFormOpen && (
              <div style={{ borderTop:'1px solid var(--color-border)', paddingTop:14 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">닉네임 *</label>
                    <input className="form-input" placeholder="표시될 이름" autoComplete="off"
                      value={pageForm.nickname} onChange={e => setPageForm(f => ({...f, nickname:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">페이지 URL *</label>
                    <input className="form-input" placeholder="https://trpg-diary.vercel.app/u/..." autoComplete="off"
                      value={pageForm.url} onChange={e => setPageForm(f => ({...f, url:e.target.value}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">아바타 이미지 URL (선택)</label>
                  <input className="form-input" placeholder="https://... (imgur 등)" autoComplete="off"
                    value={pageForm.avatar_url} onChange={e => setPageForm(f => ({...f, avatar_url:e.target.value}))}/>
                </div>
                {pageForm.avatar_url && (
                  <div style={{ marginBottom:10 }}>
                    <img src={pageForm.avatar_url} alt="preview"
                      style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--color-border)' }}
                      onError={e => { e.target.style.display='none' }}/>
                  </div>
                )}
                <div className="flex justify-end">
                  <button className="btn btn-primary btn-sm" onClick={submitPage} disabled={pageSubmitting}>
                    {pageSubmitting ? '등록 중...' : '등록하기'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {isOwner && mypages.length > 0 && (
            <div style={{ marginBottom:12, padding:'8px 14px', borderRadius:8, background:'var(--color-nav-active-bg)', fontSize:'0.8rem', color:'var(--color-text-light)', display:'flex', alignItems:'center', gap:6 }}>
              <Mi size="sm" color="light">edit</Mi>
              연필 버튼으로 닉네임·메모 수정, X 버튼으로 삭제할 수 있어요
            </div>
          )}

          {loading
            ? <div className="text-sm text-light" style={{ textAlign:'center', padding:20 }}>불러오는 중...</div>
            : mypages.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:32, color:'var(--color-text-light)', fontSize:'0.85rem' }}>아직 남긴 페이지가 없어요</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8 }}>
                  {mypages.map(g => (
                    <FriendChip key={g.id} g={g} isOwner={isOwner} userId={user?.id}
                      onEdit={openEdit} onRemove={removeEntry}/>
                  ))}
                </div>
          }
        </div>
      )}
    </div>
  )
}

// ── 내 홈(로그인) 방명록 관리 ──

// ── 내 홈(로그인) 방명록 관리 ──
// Hook이 조건문 아래에 있으면 안 되므로 내부 컴포넌트로 완전 분리
function GuestbookOwnerView({ user }) {
  const [messages, setMessages] = useState([])
  const [mypages, setMypages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('message')
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ nickname:'', memo:'' })

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    const { data:all } = await supabase
      .from('guestbook').select('*').eq('owner_id', user.id)
      .order('created_at', { ascending:false })
    setMessages((all||[]).filter(g => g.type==='message' || !g.type))
    setMypages((all||[]).filter(g => g.type==='mypage'))
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const removeEntry = async (id) => { await supabase.from('guestbook').delete().eq('id', id); load() }

  const openEdit = (g) => {
    const { memo } = parseEntry(g)
    setEditingItem(g)
    setEditForm({ nickname: g.author_name || '', memo })
  }

  const saveEdit = async () => {
    if (!editingItem) return
    const { url } = parseEntry(editingItem)
    const newContent = editForm.memo.trim()
      ? `${url}|||${editForm.memo.trim()}`
      : url
    const { error } = await supabase.from('guestbook').update({
      author_name: editForm.nickname.trim(),
      content: newContent,
    }).eq('id', editingItem.id).eq('owner_id', user.id)
    if (error) {
      alert('저장 실패: ' + error.message)
      return
    }
    setEditingItem(null)
    load()
  }

  return (
    <div className="fade-in">
      {/* 수정 모달 */}
      {editingItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setEditingItem(null) }}>
          <div style={{ background:'var(--color-surface)', borderRadius:12, padding:24, width:'100%', maxWidth:380, boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:16 }}>친구 페이지 수정</div>
            <div className="form-group">
              <label className="form-label">닉네임</label>
              <input className="form-input" autoComplete="off" value={editForm.nickname}
                onChange={e => setEditForm(f => ({...f, nickname:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">메모</label>
              <textarea className="form-textarea" autoComplete="off"
                placeholder="이 친구에 대한 메모를 남겨요..." rows={3}
                value={editForm.memo} onChange={e => setEditForm(f => ({...f, memo:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => setEditingItem(null)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title"><Mi style={{ marginRight:8, verticalAlign:'middle' }}>mail</Mi>방명록</h1>
        <p className="page-subtitle">내 공개 페이지에 남겨진 방명록을 관리해요</p>
      </div>

      <div className="flex gap-8" style={{ marginBottom:20 }}>
        <button className={`btn btn-sm ${tab==='message'?'btn-primary':'btn-outline'}`} onClick={() => setTab('message')}
          style={{ display:'flex', alignItems:'center', gap:4 }}>
          <Mi size="sm" color={tab==='message'?'white':'accent'}>mail</Mi>
          방명록 ({messages.length})
        </button>
        <button className={`btn btn-sm ${tab==='mypage'?'btn-primary':'btn-outline'}`} onClick={() => setTab('mypage')}
          style={{ display:'flex', alignItems:'center', gap:4 }}>
          <Mi size="sm" color={tab==='mypage'?'white':'accent'}>link</Mi>
          친구 페이지 목록 ({mypages.length})
        </button>
      </div>

      {tab === 'message' && (
        loading
          ? <div className="text-sm text-light" style={{ textAlign:'center', padding:40 }}>불러오는 중...</div>
          : messages.length === 0
            ? <div className="card" style={{ textAlign:'center', padding:40, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                아직 방명록이 없어요.<br/><span style={{ fontSize:'0.8rem' }}>공개 페이지 링크를 공유하면 방문자들이 남길 수 있어요!</span>
              </div>
            : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {messages.map(g => (
                  <div key={g.id} className="card" style={{ padding:'14px 20px' }}>
                    <div className="flex justify-between items-start" style={{ marginBottom:8 }}>
                      <div className="flex items-center gap-8">
                        <span style={{ fontWeight:600, fontSize:'0.88rem' }}>{g.author_name || '익명'}</span>
                        {g.is_private && <span className="badge badge-gray" style={{ fontSize:'0.62rem' }}>🔒 비공개</span>}
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-xs text-light">{fmtDT(g.created_at)}</span>
                        <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'1px 6px' }}
                          onClick={() => removeEntry(g.id)}>삭제</button>
                      </div>
                    </div>
                    <p style={{ fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                      {g.is_private ? '🔒 비공개 메시지' : g.content}
                    </p>
                  </div>
                ))}
              </div>
      )}

      {tab === 'mypage' && (
        <div>
          {mypages.length > 0 && (
            <div style={{ marginBottom:12, padding:'8px 14px', borderRadius:8, background:'var(--color-nav-active-bg)', fontSize:'0.8rem', color:'var(--color-text-light)', display:'flex', alignItems:'center', gap:6 }}>
              <Mi size="sm" color="light">edit</Mi>
              연필 버튼으로 닉네임·메모 수정, X 버튼으로 삭제할 수 있어요
            </div>
          )}
          {loading
            ? <div className="text-sm text-light" style={{ textAlign:'center', padding:40 }}>불러오는 중...</div>
            : mypages.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:40, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                  아직 남긴 페이지가 없어요.<br/><span style={{ fontSize:'0.8rem' }}>방문자들이 공개 페이지에서 링크를 남길 수 있어요!</span>
                </div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8 }}>
                  {mypages.map(g => (
                    <FriendChip key={g.id} g={g} isOwner={true} userId={user?.id}
                      onEdit={openEdit} onRemove={removeEntry}/>
                  ))}
                </div>
          }
        </div>
      )}
    </div>
  )
}

// GuestbookPage: ownerId 있으면 공개뷰, 없으면 오너뷰 — Hook 규칙 준수
export function GuestbookPage({ ownerId }) {
  const { user } = useAuth()
  if (ownerId) return <GuestbookPublicView ownerId={ownerId}/>
  return <GuestbookOwnerView user={user}/>
}
