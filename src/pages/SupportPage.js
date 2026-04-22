// src/pages/SupportPage.js
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'

const CATEGORIES = ['버그신고', '기능제안', '계정문의', '기타']

const STATUS_LABEL = {
  pending:     { label:'대기중',   bg:'#9e9e9e', color:'#fff' },
  in_progress: { label:'검토중',   bg:'#1976d2', color:'#fff' },
  resolved:    { label:'답변완료', bg:'#388e3c', color:'#fff' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.pending
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:'2px 10px', borderRadius:100,
      fontSize:'0.68rem', fontWeight:700,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  )
}

// 문의 아코디언 카드
function InquiryCard({ item, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding:'14px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
            <span style={{
              padding:'1px 8px', borderRadius:100, fontSize:'0.68rem', fontWeight:700,
              background:'var(--color-nav-active-bg)', color:'var(--color-accent)',
            }}>{item.category}</span>
            <StatusBadge status={item.status}/>
            {item.status === 'resolved' && (
              <Mi size="sm" color="accent" style={{ color:'#388e3c' }}>mark_email_read</Mi>
            )}
          </div>
          <div style={{ fontWeight:700, fontSize:'0.92rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {item.title}
          </div>
          <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginTop:3 }}>
            {new Date(item.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {item.status === 'pending' && (
            <button className="btn btn-ghost btn-sm"
              style={{ color:'#e57373', fontSize:'0.72rem', padding:'2px 8px' }}
              onClick={e => { e.stopPropagation(); onDelete(item.id) }}>삭제</button>
          )}
          <span className="ms" style={{ fontSize:18, color:'var(--color-text-light)', transition:'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            expand_more
          </span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--color-border)' }}>
          {/* 원문 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginBottom:6, fontWeight:600 }}>문의 내용</div>
            <p style={{ fontSize:'0.88rem', lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--color-text)' }}>
              {item.content}
            </p>
          </div>

          {/* 관리자 답변 */}
          {item.admin_reply ? (
            <div style={{
              background:'var(--color-nav-active-bg)',
              borderRadius:10, padding:'12px 16px',
              borderLeft:'3px solid var(--color-primary)',
            }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--color-primary)', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                <Mi size="sm">support_agent</Mi>관리자 답변
                <span style={{ fontWeight:400, color:'var(--color-text-light)', marginLeft:4 }}>
                  {item.replied_at ? new Date(item.replied_at).toLocaleDateString('ko-KR') : ''}
                </span>
              </div>
              <p style={{ fontSize:'0.88rem', lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--color-text)' }}>
                {item.admin_reply}
              </p>
            </div>
          ) : (
            <div style={{ fontSize:'0.82rem', color:'var(--color-text-light)', padding:'10px 0', textAlign:'center' }}>
              아직 답변이 등록되지 않았어요. 빠른 시일 내에 확인할게요 🙏
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'history' ? 'history' : 'form')

  // 문의 폼
  const [form, setForm] = useState({ email:'', category:'버그신고', title:'', content:'' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 내 문의 내역
  const [myList, setMyList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const { paged, totalPages, page, setPage } = usePagination(myList, 10)

  // 이메일 기본값 (auth user 이메일)
  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, email: user.email }))
  }, [user])

  const loadMyList = async () => {
    if (!user) return
    setListLoading(true)
    const { data } = await supabase.from('inquiries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setMyList(data || [])
    setListLoading(false)
  }

  useEffect(() => {
    if (tab === 'history') loadMyList()
  }, [tab, user]) // eslint-disable-line

  const handleSubmit = async () => {
    if (!form.email.trim() || !form.title.trim() || !form.content.trim()) {
      alert('이메일, 제목, 내용을 모두 입력해주세요.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('inquiries').insert({
      user_id:  user.id,
      email:    form.email.trim(),
      category: form.category,
      title:    form.title.trim(),
      content:  form.content.trim(),
    })
    setSubmitting(false)
    if (error) { alert('제출 실패: ' + error.message); return }
    setSubmitted(true)
    // 내 문의 내역 탭으로 전환
    setTimeout(() => {
      setSubmitted(false)
      setForm(f => ({ ...f, category:'버그신고', title:'', content:'' }))
      setTab('history')
    }, 1800)
  }

  const handleDelete = async (id) => {
    await supabase.from('inquiries').delete().eq('id', id)
    setDeleteConfirm(null)
    loadMyList()
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <Mi style={{ marginRight:8, verticalAlign:'middle' }}>support_agent</Mi>문의하기
        </h1>
        <p className="page-subtitle">궁금한 점이나 불편한 점을 알려주세요. 빠르게 확인해 드릴게요.</p>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:8, marginBottom:20, borderBottom:'1px solid var(--color-border)', paddingBottom:0 }}>
        {[
          { key:'form', label:'문의하기', icon:'edit_note' },
          { key:'history', label:'내 문의 내역', icon:'history' },
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

      {/* ── 문의하기 탭 ── */}
      {tab === 'form' && (
        submitted ? (
          <div style={{
            textAlign:'center', padding:'60px 20px',
            color:'var(--color-text-light)', fontSize:'0.95rem',
          }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:8, color:'var(--color-text)' }}>
              문의가 접수되었어요!
            </div>
            <div style={{ fontSize:'0.85rem' }}>답변은 내 문의 내역 탭에서 확인하실 수 있어요.</div>
          </div>
        ) : (
          <div style={{ maxWidth:600 }}>
            <div className="card" style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>

              {/* 이메일 */}
              <div>
                <label className="form-label">답변받을 이메일 *</label>
                <input className="form-input" type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="example@email.com"/>
              </div>

              {/* 문의 유형 */}
              <div>
                <label className="form-label">문의 유형 *</label>
                <select className="form-select"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 제목 */}
              <div>
                <label className="form-label">제목 *</label>
                <input className="form-input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="문의 제목을 입력해주세요"
                  maxLength={100}/>
                <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', textAlign:'right', marginTop:3 }}>
                  {form.title.length}/100
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label className="form-label">내용 *</label>
                <textarea className="form-textarea"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="문의 내용을 상세히 적어주세요"
                  maxLength={2000}
                  style={{ minHeight:160 }}/>
                <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', textAlign:'right', marginTop:3 }}>
                  {form.content.length}/2000
                </div>
              </div>

              <button className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !form.email.trim() || !form.title.trim() || !form.content.trim()}
                style={{ alignSelf:'flex-end', minWidth:100 }}>
                {submitting ? '제출 중...' : '문의 제출'}
              </button>
            </div>
          </div>
        )
      )}

      {/* ── 내 문의 내역 탭 ── */}
      {tab === 'history' && (
        listLoading ? <LoadingSpinner/> :
        myList.length === 0
          ? <EmptyState icon="support_agent" title="아직 문의 내역이 없어요" description="궁금한 점이 있으면 언제든지 문의해주세요!"/>
          : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {paged.map(item => (
                <InquiryCard key={item.id} item={item} onDelete={setDeleteConfirm}/>
              ))}
              {totalPages > 1 && (
                <div style={{ display:'flex', justifyContent:'center', marginTop:10 }}>
                  {Array.from({ length: totalPages }, (_,i) => (
                    <button key={i} className={`btn btn-sm ${page===i+1?'btn-primary':'btn-outline'}`}
                      style={{ margin:'0 2px' }}
                      onClick={() => setPage(i+1)}>{i+1}</button>
                  ))}
                </div>
              )}
            </div>
          )
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm)}
        message="이 문의를 삭제하시겠어요? (미답변 문의만 삭제 가능해요)"/>
    </div>
  )
}
