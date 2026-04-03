// src/pages/GuestbookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const fmtDT = (d) => {
  const dt = new Date(d)
  const date = dt.toLocaleDateString('ko-KR', { year:'2-digit', month:'numeric', day:'numeric' })
  const time = dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
  return `${date} ${time}`
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

  // 오너 수정 상태
  const [editingId, setEditingId] = useState(null)
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
      content:pageForm.url.trim(), type:'mypage',
    })
    setPageForm({ nickname:'', url:'', avatar_url:'' })
    setPageFormOpen(false)
    setPageDone(true); setTimeout(() => setPageDone(false), 3000)
    load(); setPageSubmitting(false)
  }

  const removeEntry = async (id) => { await supabase.from('guestbook').delete().eq('id', id); load() }

  // 수정 저장
  const saveEdit = async (id) => {
    await supabase.from('guestbook').update({
      author_name: editForm.nickname.trim(),
      // memo는 별도 컬럼이 없으면 content에 저장하거나, description 활용
      // 여기서는 author_name에 메모를 덧붙이는 대신 별도 필드로 저장
    }).eq('id', id)
    // description 컬럼이 없으면 content를 메모로 활용 (url || 메모 구분자)
    const item = mypages.find(p => p.id === id)
    const originalUrl = item?.content?.startsWith('http') ? item.content : item?.author_username ? `https://trpg-diary.vercel.app/u/${item.author_username}` : item?.content || ''
    const newContent = editForm.memo.trim() ? `${originalUrl}|||${editForm.memo.trim()}` : originalUrl
    await supabase.from('guestbook').update({
      author_name: editForm.nickname.trim(),
      content: newContent,
    }).eq('id', id)
    setEditingId(null); load()
  }

  // url과 메모 파싱
  const parseEntry = (g) => {
    const raw = g.content || ''
    if (raw.includes('|||')) {
      const [url, memo] = raw.split('|||')
      return { url, memo }
    }
    return { url: raw, memo: '' }
  }

  return (
    <div>
      <div className="flex gap-8" style={{ marginBottom:20 }}>
        <button className={`btn btn-sm ${tab==='message'?'btn-primary':'btn-outline'}`} onClick={() => setTab('message')}>
          💌 방명록 ({messages.length})
        </button>
        <button className={`btn btn-sm ${tab==='mypage'?'btn-primary':'btn-outline'}`} onClick={() => setTab('mypage')}>
          🔗 친구 페이지 목록 ({mypages.length})
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
                              <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'1px 6px' }} onClick={() => removeEntry(g.id)}>삭제</button>
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
                <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:2 }}>🔗 내 페이지 남기기</div>
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
            <div style={{ marginBottom:12, padding:'8px 14px', borderRadius:8, background:'var(--color-nav-active-bg)', fontSize:'0.8rem', color:'var(--color-text-light)' }}>
              💡 연필 버튼으로 닉네임·메모 수정, ✕ 버튼으로 삭제할 수 있어요
            </div>
          )}

          {loading
            ? <div className="text-sm text-light" style={{ textAlign:'center', padding:20 }}>불러오는 중...</div>
            : mypages.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:32, color:'var(--color-text-light)', fontSize:'0.85rem' }}>아직 남긴 페이지가 없어요</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {mypages.map(g => {
                    const { url, memo } = parseEntry(g)
                    const href = url?.startsWith('http') ? url : g.author_username ? `/u/${g.author_username}` : '#'
                    const isEditing = editingId === g.id

                    return (
                      <div key={g.id} className="card card-sm" style={{ display:'flex', alignItems:'center', gap:12 }}>
                        {/* 아바타 */}
                        <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration:'none', flexShrink:0 }}>
                          <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', color:'white', fontWeight:700 }}>
                            {g.author_avatar_url
                              ? <img src={g.author_avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.style.display='none' }}/>
                              : (g.author_name||'?')[0]
                            }
                          </div>
                        </a>

                        {/* 내용 */}
                        <div style={{ flex:1, minWidth:0 }}>
                          {isEditing ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              <input className="form-input" autoComplete="off" value={editForm.nickname}
                                onChange={e => setEditForm(f => ({...f, nickname:e.target.value}))}
                                placeholder="닉네임" style={{ fontSize:'0.85rem' }}/>
                              <input className="form-input" autoComplete="off" value={editForm.memo}
                                onChange={e => setEditForm(f => ({...f, memo:e.target.value}))}
                                placeholder="메모 (선택)" style={{ fontSize:'0.82rem' }}/>
                            </div>
                          ) : (
                            <div>
                              <a href={href} target="_blank" rel="noreferrer"
                                style={{ fontWeight:600, fontSize:'0.9rem', color:'var(--color-text)', textDecoration:'none' }}>
                                {g.author_name}
                              </a>
                              {g.author_username && (
                                <span className="text-xs text-light" style={{ marginLeft:6 }}>@{g.author_username}</span>
                              )}
                              {memo && (
                                <div className="text-xs text-light" style={{ marginTop:2 }}>📝 {memo}</div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 오너 편집 버튼 */}
                        {isOwner && (
                          <div className="flex gap-6" style={{ flexShrink:0 }}>
                            {isEditing ? (
                              <>
                                <button className="btn btn-primary btn-sm" style={{ padding:'3px 10px' }} onClick={() => saveEdit(g.id)}>저장</button>
                                <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px' }} onClick={() => setEditingId(null)}>취소</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px' }}
                                  onClick={() => { setEditingId(g.id); setEditForm({ nickname:g.author_name||'', memo }) }}
                                  title="수정">✏️</button>
                                <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'3px 8px' }}
                                  onClick={() => removeEntry(g.id)} title="삭제">✕</button>
                              </>
                            )}
                          </div>
                        )}
                        {/* 본인이 남긴 경우 삭제 */}
                        {!isOwner && g.author_id && g.author_id === user?.id && (
                          <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'3px 8px', flexShrink:0 }}
                            onClick={() => removeEntry(g.id)}>✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>
          }
        </div>
      )}
    </div>
  )
}

// ── 내 홈(로그인) 방명록 관리 ──
export function GuestbookPage({ ownerId }) {
  const { user } = useAuth()

  if (ownerId) return <GuestbookPublicView ownerId={ownerId}/>

  const [messages, setMessages] = useState([])
  const [mypages, setMypages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('message')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ nickname:'', memo:'' })

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    const { data:all } = await supabase.from('guestbook').select('*').eq('owner_id', user.id).order('created_at', { ascending:false })
    setMessages((all||[]).filter(g => g.type==='message' || !g.type))
    setMypages((all||[]).filter(g => g.type==='mypage'))
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const removeEntry = async (id) => { await supabase.from('guestbook').delete().eq('id', id); load() }

  const parseEntry = (g) => {
    const raw = g.content || ''
    if (raw.includes('|||')) {
      const [url, memo] = raw.split('|||')
      return { url, memo }
    }
    return { url: raw, memo: '' }
  }

  const saveEdit = async (id) => {
    const item = mypages.find(p => p.id === id)
    const { url } = parseEntry(item)
    const newContent = editForm.memo.trim() ? `${url}|||${editForm.memo.trim()}` : url
    await supabase.from('guestbook').update({ author_name:editForm.nickname.trim(), content:newContent }).eq('id', id)
    setEditingId(null); load()
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">💌 방명록</h1>
        <p className="page-subtitle">내 공개 페이지에 남겨진 방명록을 관리해요</p>
      </div>
      <div className="flex gap-8" style={{ marginBottom:20 }}>
        <button className={`btn btn-sm ${tab==='message'?'btn-primary':'btn-outline'}`} onClick={() => setTab('message')}>
          💌 방명록 ({messages.length})
        </button>
        <button className={`btn btn-sm ${tab==='mypage'?'btn-primary':'btn-outline'}`} onClick={() => setTab('mypage')}>
          🔗 친구 페이지 목록 ({mypages.length})
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
                        <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'1px 6px' }} onClick={() => removeEntry(g.id)}>삭제</button>
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
            <div style={{ marginBottom:12, padding:'8px 14px', borderRadius:8, background:'var(--color-nav-active-bg)', fontSize:'0.8rem', color:'var(--color-text-light)' }}>
              💡 ✏️ 버튼으로 닉네임·메모 수정, ✕ 버튼으로 삭제할 수 있어요
            </div>
          )}
          {loading
            ? <div className="text-sm text-light" style={{ textAlign:'center', padding:40 }}>불러오는 중...</div>
            : mypages.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:40, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                  아직 남긴 페이지가 없어요.<br/><span style={{ fontSize:'0.8rem' }}>방문자들이 공개 페이지에서 링크를 남길 수 있어요!</span>
                </div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {mypages.map(g => {
                    const { url, memo } = parseEntry(g)
                    const href = url?.startsWith('http') ? url : g.author_username ? `/u/${g.author_username}` : '#'
                    const isEditing = editingId === g.id
                    return (
                      <div key={g.id} className="card card-sm" style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration:'none', flexShrink:0 }}>
                          <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', color:'white', fontWeight:700 }}>
                            {g.author_avatar_url
                              ? <img src={g.author_avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.style.display='none' }}/>
                              : (g.author_name||'?')[0]
                            }
                          </div>
                        </a>
                        <div style={{ flex:1, minWidth:0 }}>
                          {isEditing ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              <input className="form-input" autoComplete="off" value={editForm.nickname}
                                onChange={e => setEditForm(f => ({...f, nickname:e.target.value}))}
                                placeholder="닉네임" style={{ fontSize:'0.85rem' }}/>
                              <input className="form-input" autoComplete="off" value={editForm.memo}
                                onChange={e => setEditForm(f => ({...f, memo:e.target.value}))}
                                placeholder="메모 (선택)" style={{ fontSize:'0.82rem' }}/>
                            </div>
                          ) : (
                            <div>
                              <a href={href} target="_blank" rel="noreferrer"
                                style={{ fontWeight:600, fontSize:'0.9rem', color:'var(--color-text)', textDecoration:'none' }}>
                                {g.author_name}
                              </a>
                              {g.author_username && <span className="text-xs text-light" style={{ marginLeft:6 }}>@{g.author_username}</span>}
                              {memo && <div className="text-xs text-light" style={{ marginTop:2 }}>📝 {memo}</div>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-6" style={{ flexShrink:0 }}>
                          {isEditing ? (
                            <>
                              <button className="btn btn-primary btn-sm" style={{ padding:'3px 10px' }} onClick={() => saveEdit(g.id)}>저장</button>
                              <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px' }} onClick={() => setEditingId(null)}>취소</button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px' }}
                                onClick={() => { setEditingId(g.id); setEditForm({ nickname:g.author_name||'', memo }) }}>✏️</button>
                              <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'3px 8px' }}
                                onClick={() => removeEntry(g.id)}>✕</button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
          }
        </div>
      )}
    </div>
  )
}
