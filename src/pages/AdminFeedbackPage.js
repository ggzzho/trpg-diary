// src/pages/AdminFeedbackPage.js
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { ConfirmDialog, LoadingSpinner, EmptyState, Modal } from '../components/Layout'
import { fmtDTShort as fmtDT } from '../lib/dateFormatters'

// ── 상태 배지 ─────────────────────────────────────────────────
const STATUS_OPT = [
  { k:'pending',     label:'대기중',   bg:'#9e9e9e', color:'#fff' },
  { k:'in_progress', label:'검토중',   bg:'#1976d2', color:'#fff' },
  { k:'resolved',    label:'답변완료', bg:'#388e3c', color:'#fff' },
]
function StatusBadge({ status }) {
  const s = STATUS_OPT.find(o => o.k === status) || STATUS_OPT[0]
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:'2px 10px', borderRadius:100,
      fontSize:'0.68rem', fontWeight:700,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  )
}

const CATEGORY_COLORS = {
  '버그신고': { bg:'#ffebee', color:'#c62828' },
  '기능제안': { bg:'#e8f5e9', color:'#2e7d32' },
  '계정문의': { bg:'#e3f2fd', color:'#1565c0' },
  '기타':     { bg:'#f3e5f5', color:'#6a1b9a' },
}

// ── 신규 문의함 탭 ─────────────────────────────────────────────
function InquiryBoard({ adminId, refreshNotifs }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null) // 상세 모달
  const [replyText, setReplyText] = useState('')
  const [replyStatus, setReplyStatus] = useState('resolved')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2500)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(item => {
    const matchStatus   = statusFilter === 'all' || item.status === statusFilter
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchSearch   = !search.trim()
      || (item.title||'').includes(search)
      || (item.content||'').includes(search)
      || (item.email||'').includes(search)
    return matchStatus && matchCategory && matchSearch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // 필터 변경 시 1페이지 리셋
  useEffect(() => { setPage(1) }, [statusFilter, categoryFilter, search])

  const openDetail = async (item) => {
    setSelected(item)
    setReplyText(item.admin_reply || '')
    setReplyStatus(item.status === 'pending' ? 'resolved' : item.status)
    // inquiry_new 알림 읽음 처리
    const { count } = await supabase.from('notifications')
      .select('id', { count:'exact', head:true })
      .eq('type', 'inquiry_new').eq('ref_id', item.id).eq('is_read', false)
    if (count > 0) {
      await supabase.from('notifications')
        .update({ is_read: true })
        .eq('type', 'inquiry_new').eq('ref_id', item.id)
      refreshNotifs?.()
    }
  }

  const saveReply = async () => {
    if (!selected) return
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('inquiries').update({
      admin_reply: replyText.trim() || null,
      status:      replyStatus,
      replied_at:  replyText.trim() ? now : null,
      updated_at:  now,
    }).eq('id', selected.id)
    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }

    // 알림 발송은 DB 트리거(notify_user_inquiry_reply)가 처리

    setSaving(false)
    setSelected(null)
    load()
  }

  const deleteInquiry = async (id) => {
    await supabase.from('inquiries').delete().eq('id', id)
    setDeleteConfirm(null)
    if (selected?.id === id) setSelected(null)
    load()
  }

  const counts = {
    all:         items.length,
    pending:     items.filter(i => i.status === 'pending').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    resolved:    items.filter(i => i.status === 'resolved').length,
  }

  if (loading) return <LoadingSpinner/>

  return (
    <>
      {/* 필터 행 */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {/* 상태 필터 */}
        <div style={{ display:'flex', gap:6 }}>
          {[
            { k:'all',         label:`전체 (${counts.all})` },
            { k:'pending',     label:`대기중 (${counts.pending})` },
            { k:'in_progress', label:`검토중 (${counts.in_progress})` },
            { k:'resolved',    label:`답변완료 (${counts.resolved})` },
          ].map(f => (
            <button key={f.k}
              className={`btn btn-sm ${statusFilter===f.k?'btn-primary':'btn-outline'}`}
              onClick={() => setStatusFilter(f.k)}>{f.label}</button>
          ))}
        </div>
        {/* 카테고리 필터 */}
        <select className="form-select" style={{ maxWidth:130, fontSize:'0.82rem', padding:'4px 8px' }}
          value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">유형 전체</option>
          {['버그신고','기능제안','계정문의','기타'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* 검색 */}
        <input className="form-input" placeholder="🔍 제목·내용·이메일 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth:240, fontSize:'0.82rem' }}/>
      </div>

      {/* 게시판 테이블 */}
      {filtered.length === 0
        ? <EmptyState icon="support_agent" title="해당하는 문의가 없어요"/>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--color-border)', borderRadius:10, overflow:'hidden' }}>
            {/* 헤더 행 */}
            <div style={{
              display:'grid', gridTemplateColumns:'60px 90px 1fr 130px 90px 80px',
              background:'var(--color-nav-active-bg)',
              padding:'9px 14px', fontSize:'0.75rem', fontWeight:700,
              color:'var(--color-text-light)', gap:8,
            }}>
              <span>#</span>
              <span>유형</span>
              <span>제목</span>
              <span>작성자</span>
              <span>접수일</span>
              <span style={{ textAlign:'center' }}>상태</span>
            </div>

            {paged.map((item, idx) => {
              const cc = CATEGORY_COLORS[item.category] || { bg:'#f5f5f5', color:'#333' }
              const authorName = item.email
              const rowNum = (page - 1) * PAGE_SIZE + idx + 1
              return (
                <div key={item.id}
                  onClick={() => openDetail(item)}
                  style={{
                    display:'grid', gridTemplateColumns:'60px 90px 1fr 130px 90px 80px',
                    padding:'11px 14px', gap:8, cursor:'pointer',
                    borderTop:'1px solid var(--color-border)',
                    background: item.status === 'pending' ? 'rgba(var(--color-primary-rgb),0.03)' : 'transparent',
                    transition:'background 0.15s',
                    alignItems:'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-nav-active-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = item.status==='pending' ? 'rgba(25,118,210,0.03)' : 'transparent'}
                >
                  <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>{rowNum}</span>
                  <span style={{
                    display:'inline-flex', padding:'2px 8px', borderRadius:100,
                    fontSize:'0.68rem', fontWeight:700,
                    background: cc.bg, color: cc.color,
                  }}>{item.category}</span>
                  <span style={{
                    fontWeight: item.status==='pending' ? 700 : 400,
                    fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    color: item.status==='pending' ? 'var(--color-text)' : 'var(--color-text-light)',
                  }}>{item.title}</span>
                  <span style={{ fontSize:'0.78rem', color:'var(--color-text-light)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {authorName}
                  </span>
                  <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>
                    {new Date(item.created_at).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' })}
                  </span>
                  <span style={{ display:'flex', justifyContent:'center' }}>
                    <StatusBadge status={item.status}/>
                  </span>
                </div>
              )
            })}
          </div>
        )
      }

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:14 }}>
          {Array.from({ length: totalPages }, (_,i) => (
            <button key={i} className={`btn btn-sm ${page===i+1?'btn-primary':'btn-outline'}`}
              style={{ minWidth:32 }} onClick={() => setPage(i+1)}>{i+1}</button>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)}
        title={selected ? `[${selected.category}] ${selected.title}` : ''}>
        {selected && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* 메타 정보 */}
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 1fr',
              gap:8, padding:'12px 14px',
              background:'var(--color-nav-active-bg)', borderRadius:8,
              fontSize:'0.80rem',
            }}>
              <div style={{ gridColumn:'1 / -1' }}><span style={{ color:'var(--color-text-light)' }}>이메일</span>&nbsp;
                <strong>{selected.email}</strong>
              </div>
              <div><span style={{ color:'var(--color-text-light)' }}>접수일</span>&nbsp;
                <strong>{fmtDT(selected.created_at)}</strong>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--color-text-light)' }}>상태</span>
                <StatusBadge status={selected.status}/>
              </div>
            </div>

            {/* 문의 원문 */}
            <div>
              <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-light)', marginBottom:6 }}>문의 내용</div>
              <p style={{ fontSize:'0.88rem', lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--color-text)' }}>
                {selected.content}
              </p>
            </div>

            <hr style={{ borderColor:'var(--color-border)', margin:0 }}/>

            {/* 관리자 답변 */}
            <div>
              <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-light)', marginBottom:6 }}>
                관리자 답변 {selected.replied_at && <span style={{ fontWeight:400 }}>({fmtDT(selected.replied_at)})</span>}
              </div>
              <textarea className="form-textarea"
                placeholder="답변을 입력하세요 (비워두면 답변 없음으로 저장)"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                style={{ minHeight:120, fontSize:'0.88rem', marginBottom:10 }}/>
              <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:'0.80rem', color:'var(--color-text-light)' }}>상태 변경</span>
                  <select className="form-select" style={{ fontSize:'0.80rem', padding:'4px 8px' }}
                    value={replyStatus} onChange={e => setReplyStatus(e.target.value)}>
                    {STATUS_OPT.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#e57373' }}
                    onClick={() => setDeleteConfirm(selected.id)}>삭제</button>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => setSelected(null)}>닫기</button>
                  <button className="btn btn-primary btn-sm"
                    onClick={saveReply} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteInquiry(deleteConfirm)} message="이 문의를 삭제하시겠어요?"/>
    </>
  )
}

// ── 레거시 문의 (기존 guestbook feedback) ─────────────────────
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

function LegacyFeedbackTab({ user, profile }) {
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
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

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
  useEffect(() => { loadAll() }, [user]) // eslint-disable-line

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
  const removeEntry = async (id) => { await supabase.from('guestbook').delete().eq('id', id); loadAll() }
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
    const matchFilter = filter === 'all' ? true : filter === 'private' ? g.is_private : filter === 'public' ? !g.is_private : true
    const matchSearch = !search.trim() || (g.author_name||'').includes(search) || (g.content||'').includes(search)
    return matchFilter && matchSearch
  })

  if (loading) return <LoadingSpinner/>

  return (
    <>
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)', padding:'8px 12px', background:'var(--color-nav-active-bg)', borderRadius:8, borderLeft:'3px solid var(--color-primary)' }}>
          이전 방명록 피드백 데이터입니다. 신규 문의는 "신규 문의함" 탭에서 관리해주세요.
        </p>
      </div>

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
                  <p style={{fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.75,
                    whiteSpace:'pre-wrap', marginBottom:12, paddingLeft:44}}>
                    {g.content}
                  </p>
                  <div style={{paddingLeft:44}}>
                    <button style={{display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
                      cursor:'pointer', color:'var(--color-text-light)', fontSize:'0.78rem', padding:0}}
                      onClick={() => toggleReply(g.id)}>
                      <Mi size="sm" color="light">chat_bubble_outline</Mi>
                      <span>{replyList.length > 0 ? `답변 ${replyList.length}개` : '답변하기'}</span>
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{marginTop:14, paddingLeft:16, borderLeft:'2px solid var(--color-border)'}}>
                      {replyList.map(r => (
                        <ReplyEditItem key={r.id} r={r}
                          onDelete={(id) => setDeleteConfirm(id)}
                          onSaved={loadAll}
                          ownerId={user?.id}/>
                      ))}
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
    </>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function AdminFeedbackPage() {
  const { user, profile, refreshNotifs } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('inquiry') // 'inquiry' | 'legacy'

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/dashboard')
  }, [profile]) // eslint-disable-line

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Mi style={{marginRight:8, verticalAlign:'middle'}}>support_agent</Mi>문의함
          </h1>
          <p className="page-subtitle">접수된 문의를 관리해요</p>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:8, marginBottom:20, borderBottom:'1px solid var(--color-border)', paddingBottom:0 }}>
        {[
          { key:'inquiry', label:'신규 문의함', icon:'inbox' },
          { key:'legacy',  label:'레거시 문의', icon:'archive' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'8px 16px', border:'none', background:'none',
              cursor:'pointer', fontSize:'0.88rem', fontWeight: tab===t.key ? 700 : 400,
              color: tab===t.key ? 'var(--color-primary)' : 'var(--color-text-light)',
              borderBottom: tab===t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom:-1,
            }}>
            <Mi size="sm" color={tab===t.key ? 'primary' : 'light'}>{t.icon}</Mi>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inquiry' && <InquiryBoard adminId={user?.id} refreshNotifs={refreshNotifs}/>}
      {tab === 'legacy'  && <LegacyFeedbackTab user={user} profile={profile}/>}
    </div>
  )
}
