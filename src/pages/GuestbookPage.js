// src/pages/GuestbookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mi } from '../components/Mi'
import { supabase } from '../lib/supabase'

const fmtDT = (d) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('ko-KR', { year:'2-digit', month:'numeric', day:'numeric' })
    + ' ' + dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
}

const parseEntry = (g) => {
  const raw = g.content || ''
  if (raw.includes('|||')) {
    const idx = raw.indexOf('|||')
    return { url: raw.slice(0, idx), memo: raw.slice(idx + 3) }
  }
  return { url: raw, memo: '' }
}

// ── 페이지네이션 ──
function Pagination({ total, perPage, page, onPage, onPerPage }) {
  const totalPages = Math.ceil(total / perPage)
  if (total === 0) return null
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginTop:16 }}>
      {/* 페이지 번호 - 중앙 */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', gap:4, alignItems:'center' }}>
        {totalPages > 1 && <>
          <button className="btn btn-ghost btn-sm" onClick={() => onPage(p => Math.max(1,p-1))} disabled={page===1}>
            <Mi size="sm">chevron_left</Mi>
          </button>
          {Array.from({ length: totalPages }, (_,i) => i+1)
            .filter(n => n===1 || n===totalPages || Math.abs(n-page)<=1)
            .reduce((acc,n,i,arr) => { if (i>0 && n-arr[i-1]>1) acc.push('...'); acc.push(n); return acc }, [])
            .map((n,i) => n==='...'
              ? <span key={`e${i}`} style={{ padding:'0 4px', color:'var(--color-text-light)', fontSize:'0.8rem' }}>…</span>
              : <button key={n} className={`btn btn-sm ${page===n?'btn-primary':'btn-outline'}`}
                  onClick={() => onPage(n)} style={{ minWidth:30, padding:'3px 6px', fontSize:'0.78rem', textAlign:'center', justifyContent:'center' }}>{n}</button>
            )}
          <button className="btn btn-ghost btn-sm" onClick={() => onPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>
            <Mi size="sm">chevron_right</Mi>
          </button>
        </>}
      </div>
      {/* 개수 선택 - 우측 */}
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        {[10, 20, 30].map(n => (
          <button key={n} className={`btn btn-sm ${perPage===n?'btn-primary':'btn-outline'}`}
            onClick={() => { onPerPage(n); onPage(1) }}
            style={{ fontSize:'0.72rem', padding:'3px 10px' }}>{n}개</button>
        ))}
      </div>
    </div>
  )
}

// ── 삭제 확인 팝업 ──
function DeleteConfirm({ isOpen, onClose, onConfirm, message = '정말 삭제하시겠어요?' }) {
  if (!isOpen) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ maxWidth:320, width:'100%', padding:'24px 24px 20px', textAlign:'center' }}>
        <div style={{ fontSize:'1.5rem', marginBottom:10 }}>🗑️</div>
        <p style={{ fontSize:'0.9rem', marginBottom:20, color:'var(--color-text)' }}>{message}</p>
        <div className="flex justify-center gap-8">
          <button className="btn btn-outline btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-sm" style={{ background:'#e57373', color:'white', borderColor:'#e57373' }} onClick={() => { onConfirm(); onClose() }}>삭제</button>
        </div>
      </div>
    </div>
  )
}

// ── 방명록 카드 ──
function GuestEntry({ g, replies, isOwner, userId, onDelete, onReply, replyOpen, onToggleReply,
  replyForm, setReplyForm, onSubmitReply, replySubmitting, authLoading, onToggleLike }) {
  const hidden = g.is_private && !isOwner && g.author_id !== userId
  const replyCount = replies.length
  const likes = Array.isArray(g.likes) ? g.likes : []
  const liked = userId && likes.includes(userId)
  const likeCount = likes.length

  return (
    <div className="card" style={{ padding:'16px 20px' }}>
      {/* 헤더 */}
      <div className="flex justify-between items-center" style={{ marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* 아바타 */}
          <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--color-nav-active-bg)',
            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
            fontSize:'0.85rem', color:'var(--color-accent)', flexShrink:0, border:'1px solid var(--color-border)' }}>
            {(g.author_name||'?')[0]}
          </div>
          {/* 닉네임 + 날짜 한 줄 */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontWeight:700, fontSize:'0.88rem' }}>{g.author_name || '익명'}</span>
            {g.is_private && <Mi size="sm" color="light">lock</Mi>}
            <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)' }}>{fmtDT(g.created_at)}</span>
          </div>
        </div>
        {(isOwner || g.author_id === userId) && (
          <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'2px 8px', fontSize:'0.75rem' }}
            onClick={() => onDelete(g.id)}>삭제</button>
        )}
      </div>

      {/* 본문 */}
      <p style={{ fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.75,
        whiteSpace:'pre-wrap', marginBottom:12, paddingLeft:44 }}>
        {hidden ? <span style={{ display:'flex', alignItems:'center', gap:4 }}><Mi size="sm" color="light">lock</Mi> 비공개 메시지예요</span> : g.content}
      </p>

      {/* 액션 바: 댓글 + 하트 */}
      <div style={{ display:'flex', alignItems:'center', gap:16, paddingLeft:44 }}>
        <button style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
          cursor:'pointer', color:'var(--color-text-light)', fontSize:'0.78rem', padding:0 }}
          onClick={() => onToggleReply(g.id)}>
          <Mi size="sm" color="light">chat_bubble_outline</Mi>
          {replyCount > 0 && <span>{replyCount}</span>}
        </button>
        <button style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
          cursor: userId ? 'pointer' : 'default', fontSize:'0.78rem', padding:0,
          color: liked ? '#e57373' : 'var(--color-text-light)',
          transition:'color 0.15s' }}
          onClick={() => userId && onToggleLike(g.id, likes)}>
          <Mi size="sm" filled={liked} style={{ color: liked ? '#e57373' : 'var(--color-text-light)' }}>
            favorite
          </Mi>
          {likeCount > 0 && <span style={{ color: liked ? '#e57373' : 'var(--color-text-light)' }}>{likeCount}</span>}
        </button>
      </div>

      {/* 댓글 영역 */}
      {replyOpen && (
        <div style={{ marginTop:14, paddingLeft:16, borderLeft:'2px solid var(--color-border)' }}>
          {replies.map(r => {
            const rHidden = r.is_private && !isOwner && r.author_id !== userId
            return (
              <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--color-border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--color-nav-active-bg)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'0.68rem', fontWeight:700, color:'var(--color-accent)', flexShrink:0,
                      border:'1px solid var(--color-border)' }}>
                      {(r.author_name||'?')[0]}
                    </div>
                    <span style={{ fontWeight:700, fontSize:'0.82rem' }}>{r.author_name || '익명'}</span>
                    {r.is_private && <Mi size="sm" color="light">lock</Mi>}
                    <span style={{ fontSize:'0.68rem', color:'var(--color-text-light)' }}>{fmtDT(r.created_at)}</span>
                  </div>
                  {(isOwner || r.author_id === userId) && (
                    <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'1px 6px', fontSize:'0.72rem' }}
                      onClick={() => onDelete(r.id)}>삭제</button>
                  )}
                </div>
                <p style={{ fontSize:'0.84rem', color:'var(--color-text-light)', lineHeight:1.65,
                  whiteSpace:'pre-wrap', paddingLeft:34 }}>
                  {rHidden ? <span style={{ display:'flex', alignItems:'center', gap:4 }}><Mi size="sm" color="light">lock</Mi> 비공개 댓글이에요</span> : r.content}
                </p>
              </div>
            )
          })}

          {/* 댓글 입력 */}
          <div style={{ marginTop:12 }}>
            <input className="form-input" autoComplete="off"
              placeholder={authLoading ? '로딩 중...' : userId ? '비워두면 내 닉네임으로 등록돼요' : '닉네임 (필수)'}
              value={replyForm.nickname}
              onChange={e => setReplyForm(f => ({...f, nickname:e.target.value}))}
              style={{ fontSize:'0.82rem', marginBottom:6 }}/>
            <textarea className="form-textarea" placeholder="댓글을 남겨보세요..."
              value={replyForm.content}
              onChange={e => setReplyForm(f => ({...f, content:e.target.value}))}
              style={{ minHeight:52, fontSize:'0.84rem', resize:'vertical', marginBottom:8 }}/>
            <div className="flex justify-between items-center">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.78rem', color:'var(--color-text-light)', cursor:'pointer' }}>
                <input type="checkbox" checked={replyForm.is_private}
                  onChange={e => setReplyForm(f => ({...f, is_private:e.target.checked}))}/>
                <Mi size="sm" color="light">lock</Mi> 비공개
              </label>
              <button className="btn btn-primary btn-sm" style={{ fontSize:'0.78rem' }}
                onClick={() => onSubmitReply(g.id)}
                disabled={replySubmitting || !replyForm.content.trim() || (!authLoading && !userId && !replyForm.nickname.trim())}>
                {replySubmitting ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 친구 페이지 칩 ──
function FriendChip({ g, isOwner, userId, onEdit, onRemove }) {
  const { url, memo } = parseEntry(g)
  const displayName = g.author_name || '익명'
  const initial = displayName[0]
  const href = url?.startsWith('http') ? url : g.author_username ? `/u/${g.author_username}` : '#'
  return (
    <div className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
        {g.author_avatar_url
          ? <img src={g.author_avatar_url} alt={displayName} style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid var(--color-border)' }}/>
          : <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'1rem', color:'var(--color-accent)', flexShrink:0 }}>{initial}</div>
        }
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:'0.88rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'var(--color-text)' }}>{displayName}</div>
          {memo && <div className="text-xs text-light" style={{ marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{memo}</div>}
        </div>
      </a>
      {(isOwner || g.author_id === userId) && (
        <div className="flex gap-6" style={{ flexShrink:0 }}>
          {isOwner && <button className="btn btn-ghost btn-sm" style={{ padding:'2px 6px' }} onClick={() => onEdit(g)}><Mi size="sm">edit</Mi></button>}
          <button className="btn btn-ghost btn-sm" style={{ padding:'2px 6px', color:'#e57373' }} onClick={() => onRemove(g.id)}><Mi size="sm">close</Mi></button>
        </div>
      )}
    </div>
  )
}

// ── 공개 페이지용 ──
export function GuestbookPublicView({ ownerId }) {
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState('message')
  const [messages, setMessages] = useState([])
  const [allReplies, setAllReplies] = useState([])
  const [mypages, setMypages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [msgPage, setMsgPage] = useState(1)
  const [msgPerPage, setMsgPerPage] = useState(10)
  const [myPage, setMyPage] = useState(1)
  const [myPerPage, setMyPerPage] = useState(10)
  const [msgForm, setMsgForm] = useState({ nickname:'', content:'', is_private:false })
  const [msgSubmitting, setMsgSubmitting] = useState(false)
  const [msgDone, setMsgDone] = useState(false)
  const [pageFormOpen, setPageFormOpen] = useState(false)
  const [pageForm, setPageForm] = useState({ nickname:'', url:'', avatar_url:'' })
  const [pageSubmitting, setPageSubmitting] = useState(false)
  const [pageDone, setPageDone] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ nickname:'', memo:'' })
  const [openReplies, setOpenReplies] = useState({})
  const [replyForms, setReplyForms] = useState({})
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const isOwner = !!(user && ownerId && user.id === ownerId)

  const loadAll = async () => {
    if (!ownerId) return
    const { data } = await supabase.from('guestbook').select('*')
      .eq('owner_id', ownerId).order('created_at', { ascending: false })
    const all = data || []
    setMessages(all.filter(g => g.type === 'message' && !g.parent_id))
    setMypages(all.filter(g => g.type === 'mypage'))
    setAllReplies(all.filter(g => !!g.parent_id))
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [ownerId, user])

  const getReplies = (parentId) => allReplies.filter(r => r.parent_id === parentId)

  // 검색 필터
  const filteredMessages = search.trim()
    ? messages.filter(g => (g.author_name||'').includes(search) || (g.content||'').includes(search))
    : messages

  const submitMsg = async () => {
    if (!msgForm.content.trim()) return
    const authorName = msgForm.nickname.trim() || profile?.display_name || profile?.username || '익명'
    setMsgSubmitting(true)
    await supabase.from('guestbook').insert({
      owner_id:ownerId, author_id:user?.id||null,
      author_name: authorName,
      content:msgForm.content.trim(), is_private:msgForm.is_private, type:'message',
    })
    setMsgForm({ nickname:'', content:'', is_private:false })
    setMsgDone(true); setTimeout(() => setMsgDone(false), 2500)
    loadAll(); setMsgSubmitting(false)
  }

  const submitPage = async () => {
    if (!pageForm.nickname.trim() || !pageForm.url.trim()) { alert('닉네임과 URL은 필수예요!'); return }
    setPageSubmitting(true)
    await supabase.from('guestbook').insert({
      owner_id:ownerId, author_id:user?.id||null,
      author_name:pageForm.nickname.trim(),
      author_avatar_url:pageForm.avatar_url.trim() || null,
      content:pageForm.url.trim(), type:'mypage',
    })
    setPageForm({ nickname:'', url:'', avatar_url:'' })
    setPageFormOpen(false)
    setPageDone(true); setTimeout(() => setPageDone(false), 3000)
    loadAll(); setPageSubmitting(false)
  }

  const removeEntry = async (id) => {
    await supabase.from('guestbook').delete().eq('id', id)
    loadAll()
  }

  const openEdit = (g) => {
    const { memo } = parseEntry(g)
    setEditingItem(g)
    setEditForm({ nickname: g.author_name || '', memo })
  }
  const saveEdit = async () => {
    if (!editingItem) return
    const newContent = editForm.memo
      ? `${editingItem.content.split('|||')[0]}|||${editForm.memo}`
      : editingItem.content.split('|||')[0]
    await supabase.from('guestbook').update({ author_name: editForm.nickname.trim(), content: newContent })
      .eq('id', editingItem.id).eq('owner_id', user.id)
    setEditingItem(null); loadAll()
  }

  const toggleReply = (id) => setOpenReplies(o => ({...o, [id]:!o[id]}))
  const getReplyForm = (id) => replyForms[id] || { nickname:'', content:'', is_private:false }
  const setReplyForm = (id, updater) => setReplyForms(f => ({...f, [id]: typeof updater==='function' ? updater(f[id]||{nickname:'',content:'',is_private:false}) : updater}))

  const submitReply = async (parentId) => {
    const form = getReplyForm(parentId)
    if (!form.content.trim()) return
    const authorName = form.nickname.trim() || profile?.display_name || profile?.username || '익명'
    setReplySubmitting(true)
    const { error } = await supabase.from('guestbook').insert({
      owner_id:ownerId, author_id:user?.id||null,
      author_name: authorName,
      content: form.content.trim(), is_private: form.is_private,
      type:'message', parent_id: parentId,
    })
    if (error) { alert('댓글 저장 실패: ' + error.message); setReplySubmitting(false); return }
    setReplyForms(f => ({...f, [parentId]: {nickname:'',content:'',is_private:false}}))
    setReplySubmitting(false); loadAll()
  }

  const toggleLike = async (id, currentLikes) => {
    if (!user) return
    const likes = Array.isArray(currentLikes) ? currentLikes : []
    const newLikes = likes.includes(user.id)
      ? likes.filter(uid => uid !== user.id)
      : [...likes, user.id]
    await supabase.from('guestbook').update({ likes: newLikes }).eq('id', id)
    // 로컬 즉시 반영
    setMessages(msgs => msgs.map(m => m.id===id ? {...m, likes:newLikes} : m))
  }

  return (
    <div>
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
        <div>
          {/* 입력 폼 */}
          <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
            <div style={{ marginBottom:8 }}>
              <label className="form-label">닉네임 {(!authLoading && !user) && <span style={{color:'#e57373'}}>*</span>}</label>
              <input className="form-input" autoComplete="off"
                placeholder={authLoading ? '로딩 중...' : user ? '비워두면 내 닉네임으로 등록돼요' : '닉네임을 입력해주세요 (필수)'}
                value={msgForm.nickname} onChange={e => setMsgForm(f => ({...f, nickname:e.target.value}))}/>
            </div>
            <textarea className="form-textarea" placeholder="방명록을 남겨보세요 💌" autoComplete="off"
              value={msgForm.content} onChange={e => setMsgForm(f => ({...f, content:e.target.value}))}
              style={{ minHeight:80, marginBottom:10 }}/>
            <div className="flex justify-between items-center">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'var(--color-text-light)', cursor:'pointer' }}>
                <input type="checkbox" checked={msgForm.is_private} onChange={e => setMsgForm(f => ({...f, is_private:e.target.checked}))}/>
                <Mi size="sm" color="light">lock</Mi> 비공개 (페이지 주인만 볼 수 있어요)
              </label>
              <div className="flex items-center gap-10">
                {msgDone && <span className="text-sm" style={{ color:'#558b2f' }}>✅ 남겼어요!</span>}
                <button className="btn btn-primary btn-sm" onClick={submitMsg}
                  disabled={msgSubmitting || !msgForm.content.trim() || (!authLoading && !user && !msgForm.nickname.trim())}>
                  {msgSubmitting ? '저장 중...' : '방명록 남기기'}
                </button>
              </div>
            </div>
          </div>

          {/* 검색 */}
          <div style={{ marginBottom:12 }}>
            <input className="form-input" placeholder="🔍 닉네임, 내용으로 검색..."
              value={search} onChange={e => { setSearch(e.target.value); setMsgPage(1) }}
              style={{ maxWidth:280 }}/>
          </div>

          {loading
            ? <div className="text-sm text-light" style={{ textAlign:'center', padding:20 }}>불러오는 중...</div>
            : filteredMessages.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:32, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                  {search ? '검색 결과가 없어요' : '아직 방명록이 없어요'}
                </div>
              : (() => {
                  const paged = filteredMessages.slice((msgPage-1)*msgPerPage, msgPage*msgPerPage)
                  return (
                    <>
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {paged.map(g => (
                          <GuestEntry key={g.id} g={g}
                            replies={getReplies(g.id)}
                            isOwner={isOwner} userId={user?.id}
                            onDelete={(id) => setDeleteConfirm(id)}
                            replyOpen={!!openReplies[g.id]}
                            onToggleReply={toggleReply}
                            replyForm={getReplyForm(g.id)}
                            setReplyForm={(updater) => setReplyForm(g.id, updater)}
                            onSubmitReply={submitReply}
                            replySubmitting={replySubmitting}
                            authLoading={authLoading}
                            onToggleLike={toggleLike}
                          />
                        ))}
                      </div>
                      <Pagination total={filteredMessages.length} perPage={msgPerPage} page={msgPage} onPage={setMsgPage} onPerPage={setMsgPerPage}/>
                    </>
                  )
                })()
          }
        </div>
      )}

      {tab === 'mypage' && (
        <div>
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
                    <input className="form-input" placeholder="https://trpg-diary.co.kr/u/..." autoComplete="off"
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
              : (() => {
                  const paged = mypages.slice((myPage-1)*myPerPage, myPage*myPerPage)
                  return (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:8 }}>
                        {paged.map(g => (
                          <FriendChip key={g.id} g={g} isOwner={isOwner} userId={user?.id}
                            onEdit={openEdit} onRemove={(id) => setDeleteConfirm(id)}/>
                        ))}
                      </div>
                      <Pagination total={mypages.length} perPage={myPerPage} page={myPage} onPage={setMyPage} onPerPage={setMyPerPage}/>
                    </>
                  )
                })()
          }
        </div>
      )}

      {editingItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="card" style={{ maxWidth:400, width:'100%', padding:24 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>페이지 정보 수정</h3>
            <div className="form-group">
              <label className="form-label">닉네임</label>
              <input className="form-input" autoComplete="off" value={editForm.nickname}
                onChange={e => setEditForm(f => ({...f, nickname:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">메모</label>
              <input className="form-input" autoComplete="off" value={editForm.memo}
                onChange={e => setEditForm(f => ({...f, memo:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => setEditingItem(null)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirm isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => removeEntry(deleteConfirm)} message="이 항목을 삭제하시겠어요? 댓글도 함께 삭제돼요."/>
    </div>
  )
}

// ── 내 홈 방명록 관리 ──
function GuestbookOwnerView({ user }) {
  const [messages, setMessages] = useState([])
  const [allReplies, setAllReplies] = useState([])
  const [mypages, setMypages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('message')
  const [search, setSearch] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ nickname:'', memo:'' })
  const [msgPage, setMsgPage] = useState(1)
  const [msgPerPage, setMsgPerPage] = useState(10)
  const [myPage, setMyPage] = useState(1)
  const [myPerPage, setMyPerPage] = useState(10)
  const [openReplies, setOpenReplies] = useState({})
  const [replyForms, setReplyForms] = useState({})
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadAll = async () => {
    const { data } = await supabase.from('guestbook').select('*')
      .eq('owner_id', user.id).order('created_at', { ascending: false })
    const all = data || []
    setMessages(all.filter(g => g.type === 'message' && !g.parent_id))
    setMypages(all.filter(g => g.type === 'mypage'))
    setAllReplies(all.filter(g => !!g.parent_id))
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [user])

  const getReplies = (parentId) => allReplies.filter(r => r.parent_id === parentId)

  const filteredMessages = search.trim()
    ? messages.filter(g => (g.author_name||'').includes(search) || (g.content||'').includes(search))
    : messages

  const removeEntry = async (id) => {
    await supabase.from('guestbook').delete().eq('id', id)
    loadAll()
  }

  const openEdit = (g) => {
    const { memo } = parseEntry(g)
    setEditingItem(g)
    setEditForm({ nickname: g.author_name || '', memo })
  }
  const saveEdit = async () => {
    if (!editingItem) return
    const newContent = editForm.memo
      ? `${editingItem.content.split('|||')[0]}|||${editForm.memo}`
      : editingItem.content.split('|||')[0]
    await supabase.from('guestbook').update({ author_name: editForm.nickname.trim(), content: newContent })
      .eq('id', editingItem.id).eq('owner_id', user.id)
    setEditingItem(null); loadAll()
  }

  const toggleReply = (id) => setOpenReplies(o => ({...o, [id]:!o[id]}))
  const getReplyForm = (id) => replyForms[id] || { nickname:'', content:'', is_private:false }
  const setReplyForm = (id, updater) => setReplyForms(f => ({...f, [id]: typeof updater==='function' ? updater(f[id]||{nickname:'',content:'',is_private:false}) : updater}))

  const submitReply = async (parentId) => {
    const form = getReplyForm(parentId)
    if (!form.content.trim()) return
    setReplySubmitting(true)
    const { error } = await supabase.from('guestbook').insert({
      owner_id: user.id, author_id: user.id,
      author_name: form.nickname.trim() || '나',
      content: form.content.trim(), is_private: form.is_private,
      type:'message', parent_id: parentId,
    })
    if (error) { alert('댓글 저장 실패: ' + error.message); setReplySubmitting(false); return }
    setReplyForms(f => ({...f, [parentId]: {nickname:'',content:'',is_private:false}}))
    setReplySubmitting(false); loadAll()
  }

  const toggleLike = async (id, currentLikes) => {
    const likes = Array.isArray(currentLikes) ? currentLikes : []
    const newLikes = likes.includes(user.id)
      ? likes.filter(uid => uid !== user.id)
      : [...likes, user.id]
    await supabase.from('guestbook').update({ likes: newLikes }).eq('id', id)
    setMessages(msgs => msgs.map(m => m.id===id ? {...m, likes:newLikes} : m))
  }

  return (
    <div className="fade-in">
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

      {tab === 'message' && (<>
        <div style={{ marginBottom:12 }}>
          <input className="form-input" placeholder="🔍 닉네임, 내용으로 검색..."
            value={search} onChange={e => { setSearch(e.target.value); setMsgPage(1) }}
            style={{ maxWidth:280 }}/>
        </div>
        {loading
          ? <div className="text-sm text-light" style={{ textAlign:'center', padding:40 }}>불러오는 중...</div>
          : filteredMessages.length === 0
            ? <div className="card" style={{ textAlign:'center', padding:40, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                {search ? '검색 결과가 없어요' : '아직 방명록이 없어요.'}<br/>
                {!search && <span style={{ fontSize:'0.8rem' }}>공개 페이지 링크를 공유하면 방문자들이 남길 수 있어요!</span>}
              </div>
            : (() => {
                const paged = filteredMessages.slice((msgPage-1)*msgPerPage, msgPage*msgPerPage)
                return (
                  <>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {paged.map(g => (
                        <GuestEntry key={g.id} g={g}
                          replies={getReplies(g.id)}
                          isOwner={true} userId={user?.id}
                          onDelete={(id) => setDeleteConfirm(id)}
                          replyOpen={!!openReplies[g.id]}
                          onToggleReply={toggleReply}
                          replyForm={getReplyForm(g.id)}
                          setReplyForm={(updater) => setReplyForm(g.id, updater)}
                          onSubmitReply={submitReply}
                          replySubmitting={replySubmitting}
                          authLoading={false}
                          onToggleLike={toggleLike}
                        />
                      ))}
                    </div>
                    <Pagination total={filteredMessages.length} perPage={msgPerPage} page={msgPage} onPage={setMsgPage} onPerPage={setMsgPerPage}/>
                  </>
                )
              })()
        }
      </>)}

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
              : (() => {
                  const paged = mypages.slice((myPage-1)*myPerPage, myPage*myPerPage)
                  return (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:8 }}>
                        {paged.map(g => (
                          <FriendChip key={g.id} g={g} isOwner={true} userId={user?.id}
                            onEdit={openEdit} onRemove={(id) => setDeleteConfirm(id)}/>
                        ))}
                      </div>
                      <Pagination total={mypages.length} perPage={myPerPage} page={myPage} onPage={setMyPage} onPerPage={setMyPerPage}/>
                    </>
                  )
                })()
          }
        </div>
      )}

      {editingItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div className="card" style={{ maxWidth:400, width:'100%', padding:24 }}>
            <h3 style={{ fontWeight:700, marginBottom:16 }}>페이지 정보 수정</h3>
            <div className="form-group">
              <label className="form-label">닉네임</label>
              <input className="form-input" autoComplete="off" value={editForm.nickname}
                onChange={e => setEditForm(f => ({...f, nickname:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">메모</label>
              <input className="form-input" autoComplete="off" value={editForm.memo}
                onChange={e => setEditForm(f => ({...f, memo:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => setEditingItem(null)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirm isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => removeEntry(deleteConfirm)} message="이 항목을 삭제하시겠어요? 댓글도 함께 삭제돼요."/>
    </div>
  )
}

export function GuestbookPage({ ownerId }) {
  const { user } = useAuth()
  if (ownerId) return <GuestbookPublicView ownerId={ownerId}/>
  return <GuestbookOwnerView user={user}/>
}

// ── 문의/피드백 (관리자 전용) ──
export function FeedbackPublicView({ ownerId }) {
  const { user, profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [allReplies, setAllReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nickname:'', email:'', content:'', is_private:true })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [openReplies, setOpenReplies] = useState({})
  const [replyForms, setReplyForms] = useState({})
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const isOwner = !!(user && ownerId && user.id === ownerId)

  const loadAll = async () => {
    if (!ownerId) return
    const { data } = await supabase.from('guestbook').select('*')
      .eq('owner_id', ownerId).eq('type', 'feedback').order('created_at', { ascending: false })
    const all = data || []
    setItems(all.filter(g => !g.parent_id))
    setAllReplies(all.filter(g => !!g.parent_id))
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [ownerId, user])

  const getReplies = (parentId) => allReplies.filter(r => r.parent_id === parentId)

  const submit = async () => {
    if (!form.content.trim()) return
    if (!authLoading && !user && !form.nickname.trim()) return
    const authorName = form.nickname.trim() || profile?.display_name || profile?.username || '익명'
    setSubmitting(true)
    const { error } = await supabase.from('guestbook').insert({
      owner_id: ownerId, author_id: user?.id || null,
      author_name: authorName,
      content: form.email.trim() ? `${form.content.trim()}\n\n📧 ${form.email.trim()}` : form.content.trim(),
      is_private: form.is_private, type: 'feedback',
    })
    if (error) { alert('전송 실패: ' + error.message); setSubmitting(false); return }
    setForm({ nickname:'', email:'', content:'', is_private:true })
    setDone(true); setTimeout(() => setDone(false), 3000)
    loadAll(); setSubmitting(false)
  }

  const removeEntry = async (id) => {
    await supabase.from('guestbook').delete().eq('id', id)
    loadAll()
  }

  const toggleReply = (id) => setOpenReplies(o => ({...o, [id]:!o[id]}))
  const getReplyForm = (id) => replyForms[id] || { nickname:'', content:'', is_private:true }
  const setReplyForm = (id, updater) => setReplyForms(f => ({...f, [id]: typeof updater==='function' ? updater(f[id]||{nickname:'',content:'',is_private:true}) : updater}))

  const submitReply = async (parentId) => {
    const rf = getReplyForm(parentId)
    if (!rf.content.trim()) return
    const authorName = rf.nickname.trim() || profile?.display_name || profile?.username || '익명'
    setReplySubmitting(true)
    const { error } = await supabase.from('guestbook').insert({
      owner_id: ownerId, author_id: user?.id || null,
      author_name: authorName,
      content: rf.content.trim(), is_private: rf.is_private,
      type: 'feedback', parent_id: parentId,
    })
    if (error) { alert('저장 실패: ' + error.message); setReplySubmitting(false); return }
    setReplyForms(f => ({...f, [parentId]: {nickname:'',content:'',is_private:true}}))
    setReplySubmitting(false); loadAll()
  }

  const paged = items.slice((page-1)*perPage, page*perPage)

  return (
    <div>
      {/* 안내 배너 */}
      <div style={{ padding:'14px 18px', borderRadius:10, background:'rgba(200,169,110,0.08)',
        border:'1px solid var(--color-border)', marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
          <Mi size="sm">support_agent</Mi> 문의/피드백 안내
        </div>
        <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)', lineHeight:1.7, margin:0 }}>
          사이트 오류, 버그, 기능 개선 요청 등을 남겨주세요.<br/>
          따로 답장을 원하신다면 이메일 주소를 함께 남겨주시면 연락드릴게요.<br/>
          개인이 운영하는 프로젝트라 답변 및 대응이 늦을 수 있는 점 양해 부탁드려요.<br/>
          <strong>문의는 기본 비공개로 처리됩니다.</strong>
        </p>
      </div>

      {/* 입력 폼 */}
      <div className="card" style={{ marginBottom:20, padding:'18px 20px' }}>
        <div className="grid-2" style={{ marginBottom:8 }}>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">닉네임 {(!authLoading && !user) && <span style={{color:'#e57373'}}>*</span>}</label>
            <input className="form-input" autoComplete="off"
              placeholder={authLoading ? '로딩 중...' : user ? '비워두면 내 닉네임으로 등록돼요' : '닉네임 (필수)'}
              value={form.nickname} onChange={e => setForm(f => ({...f, nickname:e.target.value}))}/>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">이메일 <span style={{ fontWeight:400, color:'var(--color-text-light)', fontSize:'0.78rem' }}>(선택 · 답장 원할 때)</span></label>
            <input className="form-input" type="email" autoComplete="off"
              placeholder="example@email.com"
              value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))}/>
          </div>
        </div>
        <textarea className="form-textarea" placeholder="문의 내용을 입력해주세요..."
          value={form.content} onChange={e => setForm(f => ({...f, content:e.target.value}))}
          style={{ minHeight:100, marginBottom:10 }}/>
        <div className="flex justify-between items-center">
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'var(--color-text-light)', cursor:'pointer' }}>
            <input type="checkbox" checked={form.is_private} onChange={e => setForm(f => ({...f, is_private:e.target.checked}))}/>
            <Mi size="sm" color="light">lock</Mi> 비공개 (기본값)
          </label>
          <div className="flex items-center gap-10">
            {done && <span className="text-sm" style={{ color:'#558b2f' }}>✅ 문의가 접수됐어요!</span>}
            <button className="btn btn-primary btn-sm" onClick={submit}
              disabled={submitting || !form.content.trim() || (!authLoading && !user && !form.nickname.trim())}>
              {submitting ? '전송 중...' : '문의 보내기'}
            </button>
          </div>
        </div>
      </div>

      {/* 문의 목록 (비공개면 본인+주인만 보임) */}
      {loading
        ? <div className="text-sm text-light" style={{ textAlign:'center', padding:20 }}>불러오는 중...</div>
        : items.length === 0
          ? <div className="card" style={{ textAlign:'center', padding:32, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
              아직 접수된 문의가 없어요
            </div>
          : <>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {paged.map(g => {
                  const hidden = g.is_private && !isOwner && g.author_id !== user?.id
                  if (hidden) return null
                  const replies = getReplies(g.id)
                  const replyOpen = !!openReplies[g.id]
                  const rf = getReplyForm(g.id)
                  return (
                    <div key={g.id} className="card" style={{ padding:'16px 20px' }}>
                      <div className="flex justify-between items-center" style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--color-nav-active-bg)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                            fontSize:'0.85rem', color:'var(--color-accent)', flexShrink:0, border:'1px solid var(--color-border)' }}>
                            {(g.author_name||'?')[0]}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontWeight:700, fontSize:'0.88rem' }}>{g.author_name || '익명'}</span>
                            {g.is_private && <Mi size="sm" color="light">lock</Mi>}
                            <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)' }}>{new Date(g.created_at).toLocaleDateString('ko-KR', {year:'2-digit',month:'numeric',day:'numeric'}) + ' ' + new Date(g.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>
                          </div>
                        </div>
                        {(isOwner || g.author_id === user?.id) && (
                          <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'2px 8px', fontSize:'0.75rem' }}
                            onClick={() => setDeleteConfirm(g.id)}>삭제</button>
                        )}
                      </div>
                      <p style={{ fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.75, whiteSpace:'pre-wrap', marginBottom:12, paddingLeft:44 }}>
                        {g.content}
                      </p>
                      {/* 댓글 토글 */}
                      <div style={{ paddingLeft:44 }}>
                        <button style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
                          cursor:'pointer', color:'var(--color-text-light)', fontSize:'0.78rem', padding:0 }}
                          onClick={() => toggleReply(g.id)}>
                          <Mi size="sm" color="light">chat_bubble_outline</Mi>
                          {replies.length > 0 && <span>{replies.length}</span>}
                        </button>
                      </div>
                      {/* 댓글 영역 */}
                      {replyOpen && (
                        <div style={{ marginTop:14, paddingLeft:16, borderLeft:'2px solid var(--color-border)' }}>
                          {replies.map(r => (
                            <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--color-border)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--color-nav-active-bg)',
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    fontSize:'0.68rem', fontWeight:700, color:'var(--color-accent)', flexShrink:0,
                                    border:'1px solid var(--color-border)' }}>
                                    {(r.author_name||'?')[0]}
                                  </div>
                                  <span style={{ fontWeight:700, fontSize:'0.82rem' }}>{r.author_name || '익명'}</span>
                                  {r.is_private && <Mi size="sm" color="light">lock</Mi>}
                                  <span style={{ fontSize:'0.68rem', color:'var(--color-text-light)' }}>{new Date(r.created_at).toLocaleDateString('ko-KR',{year:'2-digit',month:'numeric',day:'numeric'})}</span>
                                </div>
                                {(isOwner || r.author_id === user?.id) && (
                                  <button className="btn btn-ghost btn-sm" style={{ color:'#e57373', padding:'1px 6px', fontSize:'0.72rem' }}
                                    onClick={() => setDeleteConfirm(r.id)}>삭제</button>
                                )}
                              </div>
                              <p style={{ fontSize:'0.84rem', color:'var(--color-text-light)', lineHeight:1.65, whiteSpace:'pre-wrap', paddingLeft:34 }}>{r.content}</p>
                            </div>
                          ))}
                          <div style={{ marginTop:12 }}>
                            <input className="form-input" autoComplete="off"
                              placeholder={user ? '비워두면 내 닉네임으로 등록돼요' : '닉네임 (필수)'}
                              value={rf.nickname} onChange={e => setReplyForm(g.id, f => ({...f, nickname:e.target.value}))}
                              style={{ fontSize:'0.82rem', marginBottom:6 }}/>
                            <textarea className="form-textarea" placeholder="답변을 남겨보세요..."
                              value={rf.content} onChange={e => setReplyForm(g.id, f => ({...f, content:e.target.value}))}
                              style={{ minHeight:52, fontSize:'0.84rem', marginBottom:8 }}/>
                            <div className="flex justify-between items-center">
                              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.78rem', color:'var(--color-text-light)', cursor:'pointer' }}>
                                <input type="checkbox" checked={rf.is_private} onChange={e => setReplyForm(g.id, f => ({...f, is_private:e.target.checked}))}/>
                                <Mi size="sm" color="light">lock</Mi> 비공개
                              </label>
                              <button className="btn btn-primary btn-sm" style={{ fontSize:'0.78rem' }}
                                onClick={() => submitReply(g.id)}
                                disabled={replySubmitting || !rf.content.trim()}>
                                {replySubmitting ? '등록 중...' : '답변 등록'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <Pagination total={items.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
            </>
      }

      <DeleteConfirm isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => removeEntry(deleteConfirm)} message="이 항목을 삭제하시겠어요?"/>
    </div>
  )
}
