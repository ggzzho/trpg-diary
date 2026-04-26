// src/pages/NotificationCenterPage.js
// 알림 센터 — 반응형 레이아웃 적용 (notif-item / notif-content / notif-time)
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Mi } from '../components/Mi'
import { fmtDT, fmtAgo } from '../lib/dateFormatters'

const NOTIF_ICON = {
  guestbook_comment: 'mail',
  guestbook_reply:   'subdirectory_arrow_right',
  feedback_comment:  'support_agent',
  feedback_reply:    'mark_email_read',
  backup_ready:      'cloud_done',
  admin_notice:      'campaign',
  storage_warning:   'data_usage',
}

const NOTIF_LABEL = {
  guestbook_comment: '방명록 댓글',
  guestbook_reply:   '방명록 답글',
  feedback_comment:  '문의함 댓글',
  feedback_reply:    '문의 답변',
  backup_ready:      '자동 백업 완료',
  admin_notice:      '운영자 메시지',
  storage_warning:   '데이터 한도 안내',
}

const PER_PAGE = 30

export default function NotificationCenterPage() {
  const { refreshNotifs } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all') // all | unread
  const [msgModal, setMsgModal] = useState(null) // { message, ref_url } | null

  const load = useCallback(async () => {
    setLoading(true)
    // 최대 200건 가져와서 클라이언트 페이지네이션
    const data = await notificationsApi.getAll(200)
    setList(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'unread' ? list.filter(n => !n.is_read) : list
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleClick = async (n) => {
    if (!n.is_read) {
      await notificationsApi.markReadById(n.id)
      setList(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      refreshNotifs()
    }
    // 운영자 메시지 → 모달로 표시
    if (n.type === 'admin_notice') {
      setMsgModal({ message: n.message, ref_url: n.ref_url })
      return
    }
    // 타입별 폴백 경로
    const fallback =
      n.type === 'feedback_comment' || n.type === 'feedback_reply' ? '/admin/feedback' :
      n.type === 'storage_warning'                                  ? '/storage' :
      n.type === 'backup_ready'                                     ? '/storage' :
      '/guestbook'
    navigate(n.ref_url || fallback)
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    setList(prev => prev.map(n => ({ ...n, is_read: true })))
    refreshNotifs()
  }

  const unreadCount = list.filter(n => !n.is_read).length

  return (
    <div className="fade-in">

      {/* 운영자 메시지 모달 */}
      {msgModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setMsgModal(null)}>
          <div style={{
            background:'var(--color-surface)', borderRadius:16, padding:'28px 24px',
            maxWidth:440, width:'100%', border:'1px solid var(--color-border)',
            boxShadow:'0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <div style={{
                width:36, height:36, borderRadius:'50%', flexShrink:0,
                background:'rgba(200,169,110,0.12)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Mi style={{ fontSize:18, color:'var(--color-accent)' }}>campaign</Mi>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.95rem' }}>운영자 메시지</div>
                <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)' }}>TRPG 다이어리 운영진</div>
              </div>
              <button onClick={() => setMsgModal(null)}
                style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer',
                  color:'var(--color-text-light)', fontSize:'1.1rem', lineHeight:1, padding:4 }}>
                ✕
              </button>
            </div>

            {/* 메시지 본문 */}
            <div style={{
              padding:'14px 16px', borderRadius:10, fontSize:'0.9rem', lineHeight:1.7,
              background:'var(--color-nav-active-bg)', border:'1px solid var(--color-border)',
              whiteSpace:'pre-wrap', wordBreak:'break-word', marginBottom: msgModal.ref_url ? 14 : 20,
            }}>
              {msgModal.message}
            </div>

            {/* 바로가기 (ref_url 있을 때만) */}
            {msgModal.ref_url && (
              <button className="btn btn-outline btn-sm"
                style={{ marginBottom:16, width:'100%', justifyContent:'center' }}
                onClick={() => { setMsgModal(null); navigate(msgModal.ref_url) }}>
                <Mi size="sm">open_in_new</Mi>자세히 보기
              </button>
            )}

            <button className="btn btn-primary btn-sm"
              style={{ width:'100%', justifyContent:'center' }}
              onClick={() => setMsgModal(null)}>
              확인
            </button>
          </div>
        </div>
      )}
      <div className="page-header">
        <h1 className="page-title">
          <Mi style={{ marginRight:8, verticalAlign:'middle' }}>notifications</Mi>알림 센터
        </h1>
        <p className="page-subtitle">댓글·답글 알림을 모아볼 수 있어요</p>
      </div>

      {/* 필터 + 전체 읽음 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:6 }}>
          {[['all','전체'], ['unread','읽지 않음']].map(([v, label]) => (
            <button key={v}
              className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setFilter(v); setPage(1) }}>
              {label}
              {v === 'unread' && unreadCount > 0 && (
                <span style={{ marginLeft:5, background:'white', color:'var(--color-primary)',
                  borderRadius:100, fontSize:'0.58rem', fontWeight:700,
                  padding:'0 5px', lineHeight:'15px' }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}
            style={{ color:'var(--color-text-light)', fontSize:'0.78rem' }}>
            <Mi size="sm" style={{ marginRight:4 }}>done_all</Mi>모두 읽음 처리
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:48, color:'var(--color-text-light)' }}>
          <Mi style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>notifications_off</Mi>
          <p>{filter === 'unread' ? '읽지 않은 알림이 없어요' : '알림이 없어요'}</p>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {paged.map(n => (
              <button key={n.id} onClick={() => handleClick(n)}
                className={`card notif-item`}
                style={{ background: n.is_read ? 'var(--color-surface)' : 'rgba(200,169,110,0.07)' }}>
                {/* 아이콘 */}
                <div style={{
                  width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background: n.is_read ? 'var(--color-nav-active-bg)' : 'rgba(200,169,110,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Mi style={{ fontSize:18, color: n.is_read ? 'var(--color-text-light)' : 'var(--color-accent)' }}>
                    {NOTIF_ICON[n.type] || 'notifications'}
                  </Mi>
                </div>

                {/* 내용 */}
                <div className="notif-content">
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{
                      fontSize:'0.72rem', fontWeight:600,
                      color: n.is_read ? 'var(--color-text-light)' : 'var(--color-accent)',
                      background: n.is_read ? 'var(--color-nav-active-bg)' : 'rgba(200,169,110,0.12)',
                      padding:'1px 7px', borderRadius:100,
                    }}>
                      {NOTIF_LABEL[n.type] || n.type}
                    </span>
                    {!n.is_read && (
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-primary)', flexShrink:0 }} />
                    )}
                  </div>
                  <div style={{ fontSize:'0.88rem', fontWeight: n.is_read ? 400 : 600, color:'var(--color-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {n.message || n.type}
                  </div>
                  {n.preview && (
                    <div style={{ fontSize:'0.78rem', color:'var(--color-text-light)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {n.preview}
                    </div>
                  )}
                </div>

                {/* 시간 */}
                <div className="notif-time">
                  <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)' }}>{fmtAgo(n.created_at)}</div>
                  <div className="notif-time-abs">{fmtDT(n.created_at)}</div>
                </div>
              </button>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
                <Mi style={{ fontSize:16 }}>chevron_left</Mi>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce((acc, n, i, arr) => {
                  if (i > 0 && n - arr[i-1] > 1) acc.push('...')
                  acc.push(n)
                  return acc
                }, [])
                .map((n, i) => n === '...'
                  ? <span key={`e${i}`} style={{ padding:'0 4px', color:'var(--color-text-light)', fontSize:'0.8rem' }}>…</span>
                  : <button key={n}
                      className={`btn btn-sm ${page === n ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPage(n)}
                      style={{ minWidth:32, padding:'3px 6px', fontSize:'0.78rem', justifyContent:'center' }}>
                      {n}
                    </button>
                )}
              <button className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>
                <Mi style={{ fontSize:16 }}>chevron_right</Mi>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
