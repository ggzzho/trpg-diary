// src/pages/StoragePage.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'

// ── 공개 상수 (Dashboard에서 import) ────────────────────
export const TIER_LIMITS = {
  free:   1000,
  lv1:    3000,
  lv2:    5000,
  lv3:    8000,
  master: null,
}

const TIER_LABEL = {
  free: '일반', lv1: '♥ 원하트', lv2: '♥♥ 투하트', lv3: '♥♥♥ 풀하트', master: '마스터',
}

// labelCol: 레코드 목록에서 제목으로 쓸 컬럼명
const BOARDS = [
  { key: 'schedules',      label: '일정',          labelCol: 'title' },
  { key: 'rulebooks',      label: '보유 룰북',      labelCol: 'title' },
  { key: 'scenarios',      label: '보유 시나리오',  labelCol: 'title' },
  { key: 'wish_scenarios', label: '위시 시나리오',  labelCol: 'title' },
  { key: 'dotori',         label: '도토리',         labelCol: 'title' },
  { key: 'availability',   label: '공수표 목록',    labelCol: 'title' },
  { key: 'play_logs',      label: '다녀온 기록',    labelCol: 'title' },
  { key: 'pairs',          label: '페어/팀 목록',   labelCol: 'name'  },
  { key: 'characters',     label: 'PC 목록',        labelCol: 'name'  },
  { key: 'bookmarks',      label: '북마크',         labelCol: 'title' },
]

const RECS_PER_PAGE = 30

function getBarColor(pct) {
  if (pct >= 90) return '#e53935'
  if (pct >= 70) return '#fb8c00'
  return 'var(--color-primary)'
}

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

// ── 게시판 삭제 확인 모달 ────────────────────────────────
function BoardDeleteModal({ board, count, onConfirm, onCancel, loading }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ maxWidth:400, width:'100%', padding:'28px 24px' }}>
        <div style={{ fontSize:'1.8rem', textAlign:'center', marginBottom:14 }}>🗑️</div>
        <h3 style={{ fontWeight:700, textAlign:'center', marginBottom:10 }}>{board.label} 전체 삭제</h3>
        <p style={{ color:'var(--color-text-light)', fontSize:'0.88rem', textAlign:'center', marginBottom:6 }}>
          <strong style={{ color:'var(--color-text)' }}>{count.toLocaleString()}개</strong>의 레코드를 모두 삭제합니다.
        </p>
        <p style={{ color:'#e53935', fontSize:'0.8rem', textAlign:'center', marginBottom:24 }}>
          삭제된 데이터는 복구할 수 없어요.
        </p>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline" style={{ flex:1 }} onClick={onCancel} disabled={loading}>취소</button>
          <button className="btn" style={{ flex:1, background:'#e53935', color:'#fff', border:'none' }}
            onClick={onConfirm} disabled={loading}>
            {loading ? '삭제 중...' : '전체 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 잠긴 데이터 포함 삭제 모달 ───────────────────────────
function LockedDeleteModal({ totalCount, lockedCount, onExclude, onInclude, onCancel, loading }) {
  const unlocked = totalCount - lockedCount
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ maxWidth:420, width:'100%', padding:'28px 24px' }}>
        <div style={{ fontSize:'1.8rem', textAlign:'center', marginBottom:14 }}>🔒</div>
        <h3 style={{ fontWeight:700, textAlign:'center', marginBottom:10 }}>잠긴 데이터가 포함되어 있어요</h3>
        <p style={{ color:'var(--color-text-light)', fontSize:'0.88rem', textAlign:'center', marginBottom:6 }}>
          선택한 <strong style={{ color:'var(--color-text)' }}>{totalCount}개</strong> 중{' '}
          <strong style={{ color:'#e57373' }}>{lockedCount}개</strong>가 잠긴 항목입니다.
        </p>
        <p style={{ color:'var(--color-text-light)', fontSize:'0.82rem', textAlign:'center', marginBottom:24 }}>
          잠긴 데이터부터 삭제하시겠습니까?
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn" style={{ background:'#e53935', color:'#fff', border:'none' }}
            onClick={onInclude} disabled={loading}>
            {loading ? '삭제 중...' : `잠긴 항목 포함 전체 삭제 (${totalCount}개)`}
          </button>
          {unlocked > 0 && (
            <button className="btn btn-outline" onClick={onExclude} disabled={loading}>
              {loading ? '삭제 중...' : `잠긴 항목 제외하고 삭제 (${unlocked}개)`}
            </button>
          )}
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 일반 삭제 확인 모달 ──────────────────────────────────
function BulkDeleteModal({ count, onConfirm, onCancel, loading }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ maxWidth:380, width:'100%', padding:'28px 24px' }}>
        <div style={{ fontSize:'1.8rem', textAlign:'center', marginBottom:14 }}>🗑️</div>
        <h3 style={{ fontWeight:700, textAlign:'center', marginBottom:10 }}>선택 항목 삭제</h3>
        <p style={{ color:'var(--color-text-light)', fontSize:'0.88rem', textAlign:'center', marginBottom:6 }}>
          선택한 <strong style={{ color:'var(--color-text)' }}>{count}개</strong>를 삭제합니다.
        </p>
        <p style={{ color:'#e53935', fontSize:'0.8rem', textAlign:'center', marginBottom:24 }}>
          삭제된 데이터는 복구할 수 없어요.
        </p>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline" style={{ flex:1 }} onClick={onCancel} disabled={loading}>취소</button>
          <button className="btn" style={{ flex:1, background:'#e53935', color:'#fff', border:'none' }}
            onClick={onConfirm} disabled={loading}>
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function StoragePage() {
  const { user, profile } = useAuth()

  // ── 사용량 상태 ──
  const [counts,    setCounts]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [toast,     setToast]     = useState(null)

  // ── 레코드 브라우저 ──
  const [boardKey,    setBoardKey]    = useState('all')
  const [sortOld,     setSortOld]     = useState(false)   // false=최신순, true=오래된순
  const [records,     setRecords]     = useState([])
  const [recLoading,  setRecLoading]  = useState(false)
  const [recPage,     setRecPage]     = useState(1)

  // ── 잠금 ──
  const [lockedIds,   setLockedIds]   = useState(new Set())
  const [lockBusy,    setLockBusy]    = useState(new Set())  // 토글 중인 ID

  // ── 다중 선택 ──
  const [selected,    setSelected]    = useState(new Set())

  // ── 삭제 모달 ──
  const [confirmBoard,    setConfirmBoard]    = useState(null)   // 게시판 전체삭제
  const [bulkModal,       setBulkModal]       = useState(null)   // null | 'simple' | 'locked'
  const [isBoardDeleting, setIsBoardDeleting] = useState(false)
  const [isBulkDeleting,  setIsBulkDeleting]  = useState(false)

  const tier        = profile?.membership_tier || 'free'
  const limit       = TIER_LIMITS[tier]
  const canExport   = ['lv2','lv3','master'].includes(tier)
  const exportFree  = ['lv3','master'].includes(tier)

  const currentBoard = BOARDS.find(b => b.key === boardKey)
  const recTotal     = boardKey !== 'all' ? (counts[boardKey] || 0) : 0
  const totalPages   = Math.max(1, Math.ceil(recTotal / RECS_PER_PAGE))

  const total = useMemo(() =>
    BOARDS.reduce((s, b) => s + (counts[b.key] || 0), 0),
  [counts])
  const pct      = limit ? Math.min((total / limit) * 100, 100) : 0
  const barColor = getBarColor(pct)
  const maxBoard = useMemo(() => Math.max(...BOARDS.map(b => counts[b.key] || 0), 1), [counts])

  // ── 사용량 로드 ──
  const loadCounts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const results = await Promise.all(
      BOARDS.map(b => supabase.from(b.key).select('id', { count:'exact', head:true }).eq('user_id', user.id))
    )
    const c = {}
    BOARDS.forEach((b, i) => { c[b.key] = results[i].count || 0 })
    setCounts(c)
    setLoading(false)
  }, [user])

  useEffect(() => { loadCounts() }, [loadCounts])

  // ── 레코드 로드 ──
  const loadRecords = useCallback(async () => {
    if (!user || boardKey === 'all') { setRecords([]); return }
    const board = BOARDS.find(b => b.key === boardKey)
    if (!board) return
    setRecLoading(true)
    const start = (recPage - 1) * RECS_PER_PAGE
    const end   = start + RECS_PER_PAGE - 1
    const { data } = await supabase
      .from(boardKey)
      .select(`id, ${board.labelCol}, created_at`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: sortOld })
      .range(start, end)
    setRecords(data || [])
    setRecLoading(false)
  }, [user, boardKey, sortOld, recPage])

  useEffect(() => { loadRecords() }, [loadRecords])

  // ── 잠금 ID 로드 ──
  const loadLockedIds = useCallback(async () => {
    if (!user || boardKey === 'all') { setLockedIds(new Set()); return }
    const { data } = await supabase
      .from('locked_records')
      .select('record_id')
      .eq('user_id', user.id)
      .eq('table_name', boardKey)
    setLockedIds(new Set((data || []).map(r => r.record_id)))
  }, [user, boardKey])

  useEffect(() => { loadLockedIds() }, [loadLockedIds])

  // ── 게시판 전환 ──
  const switchBoard = (key) => {
    setBoardKey(key)
    setRecPage(1)
    setSelected(new Set())
  }

  // ── 잠금 토글 ──
  const toggleLock = async (id) => {
    if (lockBusy.has(id)) return
    setLockBusy(p => new Set([...p, id]))
    const isLocked = lockedIds.has(id)
    if (isLocked) {
      await supabase.from('locked_records').delete()
        .eq('user_id', user.id).eq('table_name', boardKey).eq('record_id', id)
      setLockedIds(p => { const n = new Set(p); n.delete(id); return n })
    } else {
      await supabase.from('locked_records').insert({ user_id: user.id, table_name: boardKey, record_id: id })
      setLockedIds(p => new Set([...p, id]))
    }
    setLockBusy(p => { const n = new Set(p); n.delete(id); return n })
  }

  // ── 선택 토글 ──
  const toggleSelect = (id) => {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const isAllSelected = records.length > 0 && records.every(r => selected.has(r.id))
  const toggleAll = () => {
    if (isAllSelected) setSelected(p => { const n = new Set(p); records.forEach(r => n.delete(r.id)); return n })
    else setSelected(p => { const n = new Set(p); records.forEach(r => n.add(r.id)); return n })
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 게시판 전체 삭제 ──
  const handleBoardDelete = async () => {
    if (!confirmBoard) return
    setIsBoardDeleting(true)
    const { error } = await supabase.rpc('delete_my_board_data', { p_table: confirmBoard.key })
    setIsBoardDeleting(false)
    setConfirmBoard(null)
    if (error) { showToast('삭제 중 오류가 발생했어요.', 'error'); return }
    showToast(`${confirmBoard.label} 데이터를 모두 삭제했어요.`)
    await loadCounts()
    if (boardKey === confirmBoard.key) { setRecords([]); setSelected(new Set()) }
  }

  // ── 선택 삭제 요청 (모달 분기) ──
  const requestBulkDelete = () => {
    const lockedCount = [...selected].filter(id => lockedIds.has(id)).length
    setBulkModal(lockedCount > 0 ? 'locked' : 'simple')
  }

  // ── 실제 선택 삭제 ──
  const executeBulkDelete = async (includeIds) => {
    setIsBulkDeleting(true)
    const ids = Array.from(includeIds)
    const { error } = await supabase.rpc('delete_selected_records', { p_table: boardKey, p_ids: ids })
    setIsBulkDeleting(false)
    setBulkModal(null)
    if (error) { showToast('삭제 중 오류가 발생했어요.', 'error'); return }
    showToast(`${ids.length}개를 삭제했어요.`)
    setSelected(p => { const n = new Set(p); ids.forEach(id => n.delete(id)); return n })
    await loadCounts()
    await loadRecords()
    await loadLockedIds()
  }

  const lockedCount = useMemo(() => [...selected].filter(id => lockedIds.has(id)).length, [selected, lockedIds])

  // ── JSON 내보내기 ──
  const handleExport = async () => {
    if (!user || !canExport) return
    setExporting(true)
    try {
      const results = await Promise.all(
        BOARDS.map(b => supabase.from(b.key).select('*').eq('user_id', user.id).limit(10000))
      )
      const dataObj = {}
      BOARDS.forEach((b, i) => { dataObj[b.key] = results[i].data || [] })
      const payload = {
        exported_at: new Date().toISOString(),
        user: { display_name: profile?.display_name||'', username: profile?.username||'', membership_tier: TIER_LABEL[tier]||tier },
        summary: { total, boards: Object.fromEntries(BOARDS.map(b => [b.key, counts[b.key]||0])) },
        data: dataObj,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `trpg_diary_backup_${new Date().toISOString().slice(0,10)}.json`
      a.click(); URL.revokeObjectURL(url)
      showToast('데이터를 내보냈어요.')
    } catch { showToast('내보내기 중 오류가 발생했어요.', 'error') }
    setExporting(false)
  }

  if (loading) return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--color-text-light)', fontSize:'0.88rem' }}>불러오는 중...</div>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth:720, margin:'0 auto', padding:'20px 0 80px' }}>

      {/* 헤더 */}
      <div className="page-header" style={{ marginBottom:24 }}>
        <h1 className="page-title">
          <Mi style={{ marginRight:8, verticalAlign:'middle' }}>storage</Mi>데이터 관리
        </h1>
        <p className="page-subtitle">내 게시판 사용량 확인 및 데이터 정리</p>
      </div>

      {/* ① 사용량 요약 */}
      <div className="card" style={{ padding:'24px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:'0.75rem', color:'var(--color-text-light)', marginBottom:5 }}>
              현재 등급 · <strong>{TIER_LABEL[tier]}</strong>
            </div>
            <div style={{ fontWeight:700, fontSize:'1.6rem', color:'var(--color-accent)', lineHeight:1 }}>
              {total.toLocaleString()}
              <span style={{ fontSize:'1rem', fontWeight:400, color:'var(--color-text-light)', marginLeft:5 }}>
                / {limit ? limit.toLocaleString() : '무제한'}개
              </span>
            </div>
          </div>
          {limit && (
            <div style={{
              padding:'5px 14px', borderRadius:99, fontSize:'0.8rem', fontWeight:700,
              background: pct>=90?'#fdecea':pct>=70?'#fff3e0':'var(--color-nav-active-bg)',
              color: barColor, border:`1px solid ${pct>=90?'#ef9a9a':pct>=70?'#ffcc80':'var(--color-border)'}`,
            }}>
              {pct.toFixed(1)}% 사용 중
            </div>
          )}
        </div>
        {limit && (
          <>
            <div style={{ background:'var(--color-border)', borderRadius:99, height:14, overflow:'hidden', marginBottom:10 }}>
              <div style={{ width:`${pct}%`, height:'100%', borderRadius:99, background:barColor, transition:'width 0.5s' }}/>
            </div>
            {pct >= 90 && <p style={{ fontSize:'0.8rem', color:'#e53935', marginTop:4 }}>⚠️ 용량이 거의 찼어요. 데이터를 정리하거나 후원을 통해 용량을 늘려보세요!</p>}
            {pct >= 70 && pct < 90 && <p style={{ fontSize:'0.8rem', color:'#fb8c00', marginTop:4 }}>📦 용량의 70% 이상을 사용 중이에요.</p>}
          </>
        )}
        {/* 등급별 한도 */}
        <div style={{ marginTop:18, padding:'10px 16px', borderRadius:10, background:'var(--color-nav-active-bg)',
          border:'1px solid var(--color-border)', display:'flex', gap:16, flexWrap:'wrap' }}>
          {[{t:'free',l:'일반',v:1000},{t:'lv1',l:'♥',v:3000},{t:'lv2',l:'♥♥',v:5000},{t:'lv3',l:'♥♥♥',v:8000}].map(d=>(
            <div key={d.t} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flex:'1 1 60px', opacity:tier===d.t?1:0.45 }}>
              <span style={{ fontSize:'0.68rem', fontWeight:700, color:tier===d.t?'var(--color-primary)':'var(--color-text-light)' }}>{d.l}</span>
              <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)' }}>{d.v.toLocaleString()}개</span>
            </div>
          ))}
        </div>
      </div>

      {/* ② 레코드 관리 */}
      <div className="card" style={{ padding:'20px 24px', marginBottom:16 }}>

        {/* 툴바 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {/* 카테고리 선택 */}
          <select
            value={boardKey}
            onChange={e => switchBoard(e.target.value)}
            style={{ padding:'7px 12px', fontSize:'0.85rem', borderRadius:8,
              border:'1px solid var(--color-border)', background:'var(--color-bg)',
              color:'var(--color-text)', cursor:'pointer', flex:'0 0 auto' }}>
            <option value="all">📋 전체 요약</option>
            {BOARDS.map(b => (
              <option key={b.key} value={b.key}>{b.label} ({(counts[b.key]||0).toLocaleString()}개)</option>
            ))}
          </select>

          {/* 정렬 (레코드 모드에서만) */}
          {boardKey !== 'all' && (
            <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid var(--color-border)' }}>
              <button
                className={`btn btn-sm ${!sortOld?'btn-primary':'btn-ghost'}`}
                style={{ borderRadius:0, borderRight:'1px solid var(--color-border)', fontSize:'0.78rem' }}
                onClick={() => { setSortOld(false); setRecPage(1) }}>
                최신순
              </button>
              <button
                className={`btn btn-sm ${sortOld?'btn-primary':'btn-ghost'}`}
                style={{ borderRadius:0, fontSize:'0.78rem' }}
                onClick={() => { setSortOld(true); setRecPage(1) }}>
                오래된순
              </button>
            </div>
          )}

          {/* 선택 카운트 */}
          {selected.size > 0 && boardKey !== 'all' && (
            <span style={{ fontSize:'0.8rem', color:'var(--color-primary)', fontWeight:600, marginLeft:'auto' }}>
              {selected.size}개 선택됨
            </span>
          )}
        </div>

        {/* ── 전체 요약 모드 ── */}
        {boardKey === 'all' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {BOARDS.map(b => {
              const cnt  = counts[b.key] || 0
              const bPct = maxBoard > 0 ? (cnt / maxBoard) * 100 : 0
              return (
                <div key={b.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button
                    onClick={() => switchBoard(b.key)}
                    style={{ fontSize:'0.82rem', color:'var(--color-primary)', minWidth:110, flexShrink:0,
                      background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0,
                      textDecoration:'underline', textDecorationColor:'transparent' }}
                    onMouseOver={e=>e.target.style.textDecorationColor='var(--color-primary)'}
                    onMouseOut={e=>e.target.style.textDecorationColor='transparent'}>
                    {b.label}
                  </button>
                  <div style={{ flex:1, background:'var(--color-border)', borderRadius:99, height:8, overflow:'hidden' }}>
                    <div style={{ width:`${bPct}%`, height:'100%', borderRadius:99,
                      background:'var(--color-primary)', transition:'width 0.4s', minWidth:cnt>0?4:0 }}/>
                  </div>
                  <span style={{ fontSize:'0.78rem', color:'var(--color-text-light)', minWidth:46, textAlign:'right', flexShrink:0 }}>
                    {cnt.toLocaleString()}개
                  </span>
                  <button
                    className="btn btn-sm btn-outline"
                    style={{ fontSize:'0.7rem', padding:'3px 10px', flexShrink:0,
                      color:cnt>0?'#e53935':'var(--color-text-light)',
                      borderColor:cnt>0?'#ef9a9a':'var(--color-border)',
                      cursor:cnt>0?'pointer':'not-allowed' }}
                    onClick={() => cnt > 0 && setConfirmBoard(b)}
                    disabled={cnt === 0}>
                    전체 삭제
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 레코드 목록 모드 ── */}
        {boardKey !== 'all' && (
          <>
            {/* 선택 도구 바 */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12,
              padding:'8px 12px', borderRadius:8, background:'var(--color-nav-active-bg)',
              border:'1px solid var(--color-border)' }}>
              <input type="checkbox" checked={isAllSelected} onChange={toggleAll}
                style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--color-primary)' }}
                title={isAllSelected ? '전체 해제' : '현재 페이지 전체 선택'}/>
              <span style={{ fontSize:'0.8rem', color:'var(--color-text-light)', flex:1 }}>
                {isAllSelected ? '현재 페이지 전체 선택됨' : '현재 페이지 전체 선택'}
              </span>
              <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>
                🔒 아이콘 클릭으로 잠금 설정
              </span>
            </div>

            {/* 레코드 리스트 */}
            {recLoading ? (
              <div style={{ padding:'40px 0', textAlign:'center', color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                불러오는 중...
              </div>
            ) : records.length === 0 ? (
              <div style={{ padding:'40px 0', textAlign:'center', color:'var(--color-text-light)', fontSize:'0.85rem' }}>
                등록된 데이터가 없어요
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {records.map((rec, i) => {
                  const isSelected = selected.has(rec.id)
                  const isLocked   = lockedIds.has(rec.id)
                  const isBusy     = lockBusy.has(rec.id)
                  const name       = rec[currentBoard?.labelCol] || '(제목 없음)'
                  return (
                    <div key={rec.id} style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'10px 8px',
                      borderBottom: i < records.length - 1 ? '1px solid var(--color-border)' : 'none',
                      background: isSelected ? 'var(--color-nav-active-bg)' : 'transparent',
                      borderRadius: i === 0 ? '8px 8px 0 0' : i === records.length-1 ? '0 0 8px 8px' : 0,
                      transition:'background 0.15s',
                    }}>
                      {/* 체크박스 */}
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(rec.id)}
                        style={{ width:16, height:16, cursor:'pointer', flexShrink:0,
                          accentColor:'var(--color-primary)' }}/>

                      {/* 제목 */}
                      <span style={{ flex:1, fontSize:'0.85rem', color:'var(--color-text)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {name}
                      </span>

                      {/* 날짜 */}
                      <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', flexShrink:0, minWidth:64 }}>
                        {fmtDate(rec.created_at)}
                      </span>

                      {/* 잠금 버튼 */}
                      <button
                        onClick={() => toggleLock(rec.id)}
                        disabled={isBusy}
                        title={isLocked ? '잠금 해제' : '잠금 설정'}
                        style={{ background:'none', border:'none', cursor:isBusy?'wait':'pointer',
                          padding:'2px 4px', display:'flex', alignItems:'center', flexShrink:0,
                          opacity:isBusy?0.5:1 }}>
                        <Mi size="sm" style={{ color: isLocked ? '#e57373' : 'var(--color-text-light)',
                          fontSize:'1.1rem' }}>
                          {isLocked ? 'lock' : 'lock_open'}
                        </Mi>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, marginTop:16 }}>
                <button className="btn btn-sm btn-outline" onClick={() => setRecPage(p=>Math.max(1,p-1))}
                  disabled={recPage === 1}><Mi size="sm">chevron_left</Mi></button>
                <span style={{ fontSize:'0.82rem', color:'var(--color-text-light)' }}>
                  {recPage} / {totalPages}
                </span>
                <button className="btn btn-sm btn-outline" onClick={() => setRecPage(p=>Math.min(totalPages,p+1))}
                  disabled={recPage === totalPages}><Mi size="sm">chevron_right</Mi></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ③ 내보내기 */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <h3 style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--color-accent)', margin:0 }}>데이터 내보내기</h3>
          {canExport && (
            <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'2px 8px', borderRadius:99,
              background:'var(--color-nav-active-bg)', color:'var(--color-primary)',
              border:'1px solid var(--color-border)' }}>
              {exportFree ? '풀하트 · 자유 내보내기' : '투하트 · 수동 내보내기'}
            </span>
          )}
        </div>
        <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)', marginBottom:16 }}>
          {canExport ? '내 모든 게시판 데이터를 JSON 파일로 내보낼 수 있어요.' : '♥♥ 투하트 이상 후원자에게 제공되는 기능이에요.'}
        </p>
        {canExport ? (
          <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting || total === 0}>
            <Mi size="sm">download</Mi>{exporting ? '내보내는 중...' : 'JSON으로 내보내기'}
          </button>
        ) : (
          <Link to="/settings" state={{ tab:'donation' }} style={{ textDecoration:'none' }}>
            <div style={{ padding:'14px 18px', borderRadius:10, background:'var(--color-nav-active-bg)',
              border:'1px dashed var(--color-border)', color:'var(--color-text-light)', fontSize:'0.82rem',
              display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <Mi size="sm" color="light">lock</Mi>
              투하트 이상 후원 시 이용 가능 · 후원 페이지로 이동 →
            </div>
          </Link>
        )}
      </div>

      {/* ── 플로팅 선택 삭제 바 ── */}
      {selected.size > 0 && boardKey !== 'all' && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'var(--color-accent)', color:'#fff',
          padding:'12px 20px', borderRadius:14, zIndex:900,
          display:'flex', alignItems:'center', gap:14,
          boxShadow:'0 4px 20px rgba(0,0,0,0.25)', whiteSpace:'nowrap',
        }}>
          <span style={{ fontSize:'0.88rem', fontWeight:600 }}>
            {selected.size}개 선택됨
            {lockedCount > 0 && <span style={{ fontSize:'0.75rem', fontWeight:400, marginLeft:6, opacity:0.8 }}>
              (잠긴 항목 {lockedCount}개 포함)
            </span>}
          </span>
          <button
            className="btn btn-sm"
            style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)',
              color:'#fff', fontSize:'0.82rem' }}
            onClick={() => setSelected(new Set())}>
            선택 해제
          </button>
          <button
            className="btn btn-sm"
            style={{ background:'#e53935', border:'none', color:'#fff', fontSize:'0.82rem' }}
            onClick={requestBulkDelete}>
            삭제
          </button>
        </div>
      )}

      {/* ── 모달들 ── */}
      {confirmBoard && (
        <BoardDeleteModal
          board={confirmBoard} count={counts[confirmBoard.key]||0}
          onConfirm={handleBoardDelete} onCancel={() => setConfirmBoard(null)}
          loading={isBoardDeleting}/>
      )}

      {bulkModal === 'simple' && (
        <BulkDeleteModal
          count={selected.size}
          onConfirm={() => executeBulkDelete(selected)}
          onCancel={() => setBulkModal(null)}
          loading={isBulkDeleting}/>
      )}

      {bulkModal === 'locked' && (
        <LockedDeleteModal
          totalCount={selected.size}
          lockedCount={lockedCount}
          onInclude={() => executeBulkDelete(selected)}
          onExclude={() => {
            const ids = new Set([...selected].filter(id => !lockedIds.has(id)))
            executeBulkDelete(ids)
          }}
          onCancel={() => setBulkModal(null)}
          loading={isBulkDeleting}/>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          background: toast.type==='error'?'#e53935':'var(--color-accent)',
          color:'#fff', padding:'10px 22px', borderRadius:10,
          fontSize:'0.85rem', zIndex:9999, whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
