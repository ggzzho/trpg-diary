// src/pages/SupportPage.js
import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { FAQList } from './FAQPage'

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

// ── 가이드라인 카드 ──────────────────────────────────────────
function GuidelineCard() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border:'1px solid var(--color-border)',
      borderLeft:'4px solid var(--color-primary)',
      borderRadius:10, marginBottom:16,
      overflow:'hidden',
    }}>
      {/* 헤더 (항상 표시) */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', cursor:'pointer',
          background:'var(--color-nav-active-bg)',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'1rem' }}>🛠️</span>
          <span style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--color-text)' }}>
            TRPG Diary 기술 지원 가이드라인
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>
            {open ? '접기' : '펼쳐보기'}
          </span>
          <span className="ms" style={{ fontSize:18, color:'var(--color-text-light)', transition:'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            expand_more
          </span>
        </div>
      </div>

      {open && (
        <div style={{ padding:'16px 20px', background:'transparent', display:'flex', flexDirection:'column', gap:14 }}>
          {/* 리드 문구 */}
          <p style={{ fontSize:'0.88rem', color:'var(--color-text-light)', fontStyle:'italic', margin:0, lineHeight:1.7 }}>
            효율적인 서비스 운영을 위해 정해진 가이드라인에 따라 문의를 접수합니다.
          </p>

          <p style={{ fontSize:'0.85rem', color:'var(--color-text)', lineHeight:1.8, margin:0 }}>
            TRPG Diary는 안정적인 시스템 유지를 최우선으로 하며, 한정된 개발 리소스를 치명적인 오류 해결에 집중하기 위해 아래와 같이 운영 정책을 시행하게 되었습니다.
          </p>

          {/* 집중 대응 */}
          <div style={{
            background:'rgba(56,142,60,0.08)', borderRadius:8, padding:'12px 16px',
            borderLeft:'3px solid #388e3c',
          }}>
            <div style={{ fontWeight:700, fontSize:'0.85rem', color:'#388e3c', marginBottom:6 }}>
              ✅ 집중 대응 항목
            </div>
            <p style={{ fontSize:'0.84rem', color:'var(--color-text)', margin:0, lineHeight:1.75 }}>
              서비스 이용 불가, 데이터 유실, 기능 결함 등 치명적 버그<br/>
              <span style={{ color:'var(--color-text-light)', fontSize:'0.80rem' }}>제보된 내용은 우선순위에 따라 즉시 검토 및 수정됩니다.</span>
            </p>
          </div>

          {/* 미대응 */}
          <div style={{
            background:'rgba(198,40,40,0.06)', borderRadius:8, padding:'12px 16px',
            borderLeft:'3px solid #c62828',
          }}>
            <div style={{ fontWeight:700, fontSize:'0.85rem', color:'#c62828', marginBottom:6 }}>
              ⛔ 미대응 항목
            </div>
            <p style={{ fontSize:'0.84rem', color:'var(--color-text)', margin:0, lineHeight:1.75 }}>
              개인적 선호에 따른 UI/UX 변경, 디자인 수정, 단순 편의 기능 제안<br/>
              <span style={{ color:'var(--color-text-light)', fontSize:'0.80rem' }}>
                해당 항목은 별도의 답변 및 개별 피드백을 제공하지 않습니다. 제안된 내용은 내부 백로그에 기록되어 추후 업데이트 시 운영자 판단에 따라 검토될 수 있습니다.
              </span>
            </p>
          </div>

          {/* 안내 */}
          <p style={{ fontSize:'0.80rem', color:'var(--color-text-light)', lineHeight:1.75, margin:0, padding:'8px 0 0' }}>
            운영 방침에 어긋나는 반복적인 제안이나 무분별한 문의는 사전 고지 없이 삭제될 수 있습니다. 원활한 서비스 환경을 위해 가이드라인을 준수해 주시길 부탁드립니다.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 문의 아코디언 카드 ──────────────────────────────────────
function InquiryCard({ item, onDelete, isUnread, onMarkRead }) {
  const [open, setOpen] = useState(false)

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && isUnread) onMarkRead(item.id)
  }

  // 답변 영역 렌더 로직
  const renderReply = () => {
    const isResolved = item.status === 'resolved'
    const hasReply   = !!item.admin_reply

    if (!isResolved) {
      // 대기중 / 검토중
      return (
        <div style={{ fontSize:'0.82rem', color:'var(--color-text-light)', padding:'10px 0', textAlign:'center' }}>
          아직 답변이 등록되지 않았어요. 빠른 시일 내에 확인하겠습니다.
        </div>
      )
    }

    // 답변완료 상태
    const replyText = hasReply
      ? item.admin_reply
      : '확인되었습니다. 향후 서비스 개선에 참고하겠습니다. 감사합니다.'

    if (!replyText) return null

    return (
      <div style={{
        background:'var(--color-nav-active-bg)',
        borderRadius:10, padding:'12px 16px',
        borderLeft:'3px solid var(--color-primary)',
      }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--color-primary)', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
          <Mi size="sm">support_agent</Mi>관리자 답변
          {item.replied_at && (
            <span style={{ fontWeight:400, color:'var(--color-text-light)', marginLeft:4 }}>
              ({new Date(item.replied_at).toLocaleDateString('ko-KR')})
            </span>
          )}
          {!hasReply && (
            <span style={{ fontWeight:400, color:'var(--color-text-light)', fontSize:'0.70rem', marginLeft:4 }}>— 자동 안내</span>
          )}
        </div>
        <p style={{ fontSize:'0.88rem', lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--color-text)', margin:0 }}>
          {replyText}
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{
      padding:'14px 18px',
      outline: isUnread ? '2px solid var(--color-primary)' : 'none',
      outlineOffset:'-2px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        onClick={handleToggle}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
            <span style={{
              padding:'1px 8px', borderRadius:100, fontSize:'0.68rem', fontWeight:700,
              background:'var(--color-nav-active-bg)', color:'var(--color-accent)',
            }}>{item.category}</span>
            <StatusBadge status={item.status}/>
            {isUnread && (
              <span style={{
                padding:'1px 8px', borderRadius:100, fontSize:'0.65rem', fontWeight:700,
                background:'var(--color-primary)', color:'#fff',
              }}>N</span>
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
          <span className="ms" style={{
            fontSize:18, color:'var(--color-text-light)',
            transition:'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>expand_more</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--color-border)' }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginBottom:6, fontWeight:600 }}>문의 내용</div>
            <p style={{ fontSize:'0.88rem', lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--color-text)', margin:0 }}>
              {item.content}
            </p>
          </div>
          {renderReply()}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function SupportPage() {
  const { user, refreshNotifs } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const t = searchParams.get('tab')
    if (t === 'history') return 'history'
    if (t === 'faq') return 'faq'
    return 'form'
  })

  // 문의 폼
  const [form, setForm] = useState({ email:'', category:'버그신고', title:'', content:'' })
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 내 문의 내역
  const [myList, setMyList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // 미읽음 알림 (inquiry_reply)
  const [unreadIds, setUnreadIds] = useState(new Set())

  const { paged, totalPages, page, setPage } = usePagination(myList, 10)

  // 이메일 기본값
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

  const loadUnreadIds = async () => {
    if (!user) return
    const { data } = await supabase.from('notifications')
      .select('ref_id')
      .eq('type', 'inquiry_reply')
      .eq('is_read', false)
    setUnreadIds(new Set((data || []).map(n => n.ref_id).filter(Boolean)))
  }

  useEffect(() => {
    if (tab === 'history') {
      loadMyList()
      loadUnreadIds()
    }
  }, [tab, user]) // eslint-disable-line

  const markInquiryRead = async (inquiryId) => {
    if (!unreadIds.has(inquiryId)) return
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('type', 'inquiry_reply')
      .eq('ref_id', inquiryId)
      .eq('is_read', false)
    setUnreadIds(prev => { const next = new Set(prev); next.delete(inquiryId); return next })
    refreshNotifs?.()
  }

  const handleSubmit = async () => {
    if (!agreed) { alert('가이드라인에 동의해주세요.'); return }
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
    setTimeout(() => {
      setSubmitted(false)
      setForm(f => ({ ...f, category:'버그신고', title:'', content:'' }))
      setAgreed(false)
      setTab('history')
    }, 1800)
  }

  const handleDelete = async (id) => {
    await supabase.from('inquiries').delete().eq('id', id)
    setDeleteConfirm(null)
    loadMyList()
  }

  const unreadCount = unreadIds.size

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <Mi style={{ marginRight:8, verticalAlign:'middle' }}>support_agent</Mi>문의하기
        </h1>
        <p className="page-subtitle">버그/오류를 우선으로 문의를 남겨주시면, 빠르게 확인해드릴게요.</p>
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', gap:8, marginBottom:20, borderBottom:'1px solid var(--color-border)', paddingBottom:0 }}>
        {[
          { key:'form',    label:'문의하기',    icon:'edit_note' },
          { key:'faq',     label:'FAQ',         icon:'help_outline' },
          { key:'history', label:'내 문의 내역', icon:'history', badge: unreadCount },
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
            {(t.badge || 0) > 0 && (
              <span style={{
                background:'var(--color-primary)', color:'white',
                borderRadius:100, fontSize:'0.6rem', fontWeight:700,
                padding:'1px 6px', minWidth:16, textAlign:'center', lineHeight:'16px',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 문의하기 탭 ── */}
      {tab === 'form' && (
        submitted ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--color-text-light)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:8, color:'var(--color-text)' }}>
              문의가 접수되었어요!
            </div>
            <div style={{ fontSize:'0.85rem' }}>답변은 내 문의 내역 탭에서 확인하실 수 있어요.</div>
          </div>
        ) : (
          <div style={{ maxWidth:600 }}>
            {/* FAQ 배너 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(var(--color-primary-rgb),0.05)',
              border: '1px solid rgba(var(--color-primary-rgb),0.2)',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mi style={{ color: 'var(--color-primary)', fontSize: 20 }}>help_outline</Mi>
                <span style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>
                  문의 전 <strong>FAQ</strong>에서 먼저 확인해보세요!
                </span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setTab('faq')}
                style={{ flexShrink: 0, fontSize: '0.80rem' }}>
                FAQ 바로가기
              </button>
            </div>

            {/* 가이드라인 카드 */}
            <GuidelineCard/>

            <div className="card" style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>

              {/* 이메일 */}
              <div>
                <label className="form-label">작성자 이메일 *</label>
                <input className="form-input" type="email"
                  value={form.email}
                  readOnly
                  style={{ background:'var(--color-nav-active-bg)', cursor:'default', color:'var(--color-text-light)' }}/>
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

              {/* 동의 체크박스 */}
              <label style={{
                display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer',
                padding:'12px 14px', borderRadius:8,
                background: agreed ? 'rgba(56,142,60,0.07)' : 'var(--color-nav-active-bg)',
                border: agreed ? '1px solid rgba(56,142,60,0.3)' : '1px solid var(--color-border)',
                transition:'all 0.2s',
              }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ width:16, height:16, marginTop:2, flexShrink:0, accentColor:'var(--color-primary)', cursor:'pointer' }}/>
                <span style={{ fontSize:'0.84rem', color: agreed ? 'var(--color-text)' : 'var(--color-text-light)', lineHeight:1.6 }}>
                  가이드라인을 확인하였으며, 이에 동의합니다.
                </span>
              </label>

              <button className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !agreed || !form.email.trim() || !form.title.trim() || !form.content.trim()}
                style={{ alignSelf:'flex-end', minWidth:100 }}>
                {submitting ? '제출 중...' : '문의 제출'}
              </button>
            </div>
          </div>
        )
      )}

      {/* ── FAQ 탭 ── */}
      {tab === 'faq' && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16, flexWrap: 'wrap', gap: 8,
          }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', margin: 0 }}>
              원하는 답변을 찾지 못하셨나요?
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('form')}>
              <Mi size="sm" color="white">edit_note</Mi> 문의하기
            </button>
          </div>
          <FAQList />
        </div>
      )}

      {/* ── 내 문의 내역 탭 ── */}
      {tab === 'history' && (
        listLoading ? <LoadingSpinner/> :
        myList.length === 0
          ? <EmptyState icon="support_agent" title="아직 문의 내역이 없어요" description="궁금한 점이 있으면 언제든지 문의해주세요!"/>
          : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {paged.map(item => (
                <InquiryCard
                  key={item.id}
                  item={item}
                  onDelete={setDeleteConfirm}
                  isUnread={unreadIds.has(item.id)}
                  onMarkRead={markInquiryRead}
                />
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
