// src/pages/AdminFeedbackPage.js
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { ConfirmDialog, LoadingSpinner, EmptyState } from '../components/Layout'
import { fmtDTShort as fmtDT } from '../lib/dateFormatters'

function ReplyEditItem({ r, onDelete, onSaved, ownerId }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(r.content)
  const isAdmin = r.author_id === ownerId
  return (
    <div style={{padding:'10px 0', borderBottom:'1px solid var(--color-border)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{width:26, height:26, borderRadius:'50%',
            background: isAdmin ? 'var(--color-primary)' : 'var(--color-nav-active-bg)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.68rem', fontWeight:700,
            color: isAdmin ? 'white' : 'var(--color-accent)',
            flexShrink:0, border:'1px solid var(--color-border)'}}>
            {(r.author_name||'?')[0]}
          </div>
          <span style={{fontWeight:700, fontSize:'0.82rem'}}>{r.author_name}</span>
          {isAdmin && <span className="badge badge-primary" style={{fontSize:'0.6rem'}}>관리자</span>}
          {r.is_private && <Mi size="sm" color="light">lock</Mi>}
          <span style={{fontSize:'0.68rem', color:'var(--color-text-light)'}}>{fmtDT(r.created_at)}</span>
        </div>
        <div style={{display:'flex', gap:4}}>
          {!editing && (
            <button className="btn btn-ghost btn-sm" style={{padding:'1px 6px', fontSize:'0.72rem'}}
              onClick={() => { setContent(r.content); setEditing(true) }}>수정</button>
          )}
          <button className="btn btn-ghost btn-sm" style={{color:'#e57373', padding:'1px 6px', fontSize:'0.72rem'}}
            onClick={() => onDelete(r.id)}>삭제</button>
        </div>
      </div>
      {editing ? (
        <div style={{paddingLeft:34}}>
          <textarea className="form-textarea" value={content}
            onChange={e => setContent(e.target.value)}
            style={{minHeight:60, fontSize:'0.84rem', marginBottom:6}}/>
          <div style={{display:'flex', gap:6}}>
            <button className="btn btn-primary btn-sm" style={{fontSize:'0.75rem'}}
              onClick={async () => {
                await supabase.from('guestbook').update({content}).eq('id', r.id)
                setEditing(false); onSaved()
              }}>저장</button>
            <button className="btn btn-outline btn-sm" style={{fontSize:'0.75rem'}}
              onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <p style={{fontSize:'0.84rem', color:'var(--color-text-light)', lineHeight:1.65, whiteSpace:'pre-wrap', paddingLeft:34}}>
          {r.content}
        </p>
      )}
    </div>
  )
}

export default function AdminFeedbackPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const postIdParam = new URLSearchParams(location.search).get('post')
  const cardRefs = useRef({})
  const [items, setItems] = useState([])
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [openReplies, setOpenReplies] = useState({})
  const [replyForms, setReplyForms] = useState({})
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [filter, setFilter] = useState('all') // all | unread | private
  const [search, setSearch] = useState('')

  // 관리자 아닌 경우 리다이렉트
  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/dashboard')
  }, [profile])

  const loadAll = async () => {
    if (!user) return
    const { data } = await supabase.from('guestbook').select('*')
      .eq('owner_id', user.id).eq('type', 'feedback')
      .order('created_at', { ascending: false })
    const all = data || []
    setItems(all.filter(g => !g.parent_id))
    setReplies(all.filter(g => !!g.parent_id))
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [user])

  // 알림 클릭 시 해당 포스트 자동 스크롤 + 댓글 오픈
  useEffect(() => {
    if (!postIdParam || loading || items.length === 0) return
    const idx = items.findIndex(m => m.id === postIdParam)
    if (idx < 0) return
    setOpenReplies(o => ({ ...o, [postIdParam]: true }))
    setTimeout(() => {
      const el = cardRefs.current[postIdParam]
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.outline = '2px solid var(--color-primary)'
      el.style.borderRadius = '12px'
      setTimeout(() => { if (el) el.style.outline = 'none' }, 2500)
    }, 350)
  }, [loading, postIdParam]) // eslint-disable-line

  const getReplies = (parentId) => replies.filter(r => r.parent_id === parentId).sort((a,b) => new Date(a.created_at)-new Date(b.created_at))

  const removeEntry = async (id) => {
    await supabase.from('guestbook').delete().eq('id', id)
    loadAll()
  }

  const getReplyForm = (id) => replyForms[id] || { content:'' }
  const setReplyForm = (id, updater) => setReplyForms(f => ({
    ...f, [id]: typeof updater==='function' ? updater(f[id]||{content:''}) : updater
  }))

  const submitReply = async (parentId, parentIsPrivate = false) => {
    const form = getReplyForm(parentId)
    if (!form.content.trim()) return
    setReplySubmitting(true)
    const { error } = await supabase.from('guestbook').insert({
      owner_id: user.id, author_id: user.id,
      author_name: profile?.display_name || profile?.username || '관리자',
      content: form.content.trim(), is_private: parentIsPrivate,
      type: 'feedback', parent_id: parentId,
    })
    if (error) { alert('저장 실패: ' + error.message); setReplySubmitting(false); return }
    setReplyForms(f => ({...f, [parentId]: {content:''}}))
    setReplySubmitting(false); loadAll()
  }

  const toggleReply = (id) => setOpenReplies(o => ({...o, [id]:!o[id]}))

  const filtered = items.filter(g => {
    const matchFilter = filter === 'all' ? true
      : filter === 'private' ? g.is_private
      : filter === 'public' ? !g.is_private
      : true
    const matchSearch = !search.trim() || (g.author_name||'').includes(search) || (g.content||'').includes(search)
    return matchFilter && matchSearch
  })

  if (loading) return <LoadingSpinner/>

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">
            <Mi style={{marginRight:8, verticalAlign:'middle'}}>support_agent</Mi>문의함
          </h1>
          <p className="page-subtitle">
            접수된 문의/피드백을 관리해요 (총 {items.length}건)
          </p>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex gap-8 items-center" style={{marginBottom:16, flexWrap:'wrap'}}>
        <div className="flex gap-6">
          {[
            {k:'all', l:`전체 (${items.length})`},
            {k:'private', l:`비공개 (${items.filter(g=>g.is_private).length})`},
            {k:'public', l:`공개 (${items.filter(g=>!g.is_private).length})`},
          ].map(f => (
            <button key={f.k} className={`btn btn-sm ${filter===f.k?'btn-primary':'btn-outline'}`}
              onClick={() => setFilter(f.k)}>{f.l}</button>
          ))}
        </div>
        <input className="form-input" placeholder="🔍 닉네임, 내용 검색..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{maxWidth:240}}/>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="support_agent" title="문의가 없어요"/>
        : <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {filtered.map(g => {
              const replyList = getReplies(g.id)
              const isOpen = !!openReplies[g.id]
              const rf = getReplyForm(g.id)
              return (
                <div key={g.id} ref={el => { cardRefs.current[g.id] = el }}
                  className="card" style={{padding:'16px 20px'}}>
                  {/* 헤더 */}
                  <div className="flex justify-between items-center" style={{marginBottom:10}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:34, height:34, borderRadius:'50%', background:'var(--color-nav-active-bg)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                        fontSize:'0.85rem', color:'var(--color-accent)', flexShrink:0, border:'1px solid var(--color-border)'}}>
                        {(g.author_name||'?')[0]}
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{fontWeight:700, fontSize:'0.88rem'}}>{g.author_name || '익명'}</span>
                        {g.is_private
                          ? <span className="badge badge-gray" style={{fontSize:'0.65rem', display:'flex', alignItems:'center', gap:3}}><Mi size="sm" color="light">lock</Mi> 비공개</span>
                          : <span className="badge badge-blue" style={{fontSize:'0.65rem'}}>공개</span>
                        }
                        <span style={{fontSize:'0.72rem', color:'var(--color-text-light)'}}>{fmtDT(g.created_at)}</span>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373', padding:'2px 8px', fontSize:'0.75rem'}}
                      onClick={() => setDeleteConfirm(g.id)}>삭제</button>
                  </div>

                  {/* 본문 */}
                  <p style={{fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.75,
                    whiteSpace:'pre-wrap', marginBottom:12, paddingLeft:44}}>
                    {g.content}
                  </p>

                  {/* 댓글 토글 */}
                  <div style={{paddingLeft:44}}>
                    <button style={{display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
                      cursor:'pointer', color:'var(--color-text-light)', fontSize:'0.78rem', padding:0}}
                      onClick={() => toggleReply(g.id)}>
                      <Mi size="sm" color="light">chat_bubble_outline</Mi>
                      <span>{replyList.length > 0 ? `답변 ${replyList.length}개` : '답변하기'}</span>
                    </button>
                  </div>

                  {/* 답변 영역 */}
                  {isOpen && (
                    <div style={{marginTop:14, paddingLeft:16, borderLeft:'2px solid var(--color-border)'}}>
                      {replyList.map(r => (
                        <ReplyEditItem key={r.id} r={r}
                          onDelete={(id) => setDeleteConfirm(id)}
                          onSaved={loadAll}
                          ownerId={user?.id}/>
                      ))}

                      {/* 답변 입력 */}
                      <div style={{marginTop:12}}>
                        <textarea className="form-textarea" placeholder="답변을 입력해주세요..."
                          value={rf.content}
                          onChange={e => setReplyForm(g.id, f => ({...f, content:e.target.value}))}
                          style={{minHeight:72, fontSize:'0.84rem', marginBottom:8}}/>
                        <div className="flex justify-end">
                          <button className="btn btn-primary btn-sm"
                            onClick={() => submitReply(g.id, g.is_private)}
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
      }

      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => removeEntry(deleteConfirm)} message="이 항목을 삭제하시겠어요?"/>
    </div>
  )
}
