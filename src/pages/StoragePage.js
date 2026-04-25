// src/pages/StoragePage.js
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'

// ── 상수 ────────────────────────────────────────────────
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

const BOARDS = [
  { key: 'schedules',      label: '일정' },
  { key: 'rulebooks',      label: '보유 룰북' },
  { key: 'scenarios',      label: '보유 시나리오' },
  { key: 'wish_scenarios', label: '위시 시나리오' },
  { key: 'dotori',         label: '도토리' },
  { key: 'availability',   label: '공수표 목록' },
  { key: 'play_logs',      label: '다녀온 기록' },
  { key: 'pairs',          label: '페어/팀 목록' },
  { key: 'characters',     label: 'PC 목록' },
  { key: 'bookmarks',      label: '북마크' },
]

function getBarColor(pct) {
  if (pct >= 90) return '#e53935'
  if (pct >= 70) return '#fb8c00'
  return 'var(--color-primary)'
}

// ── 삭제 확인 모달 ───────────────────────────────────────
function ConfirmModal({ board, count, onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: '28px 24px' }}>
        <div style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: 14 }}>🗑️</div>
        <h3 style={{ fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
          {board.label} 전체 삭제
        </h3>
        <p style={{ color: 'var(--color-text-light)', fontSize: '0.88rem', textAlign: 'center', marginBottom: 6 }}>
          <strong style={{ color: 'var(--color-text)' }}>{count.toLocaleString()}개</strong>의 레코드를 모두 삭제합니다.
        </p>
        <p style={{ color: '#e53935', fontSize: '0.8rem', textAlign: 'center', marginBottom: 24 }}>
          삭제된 데이터는 복구할 수 없어요.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel} disabled={loading}>
            취소
          </button>
          <button
            className="btn"
            style={{ flex: 1, background: '#e53935', color: '#fff', border: 'none' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '삭제 중...' : '전체 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function StoragePage() {
  const { user, profile } = useAuth()

  const [counts,    setCounts]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [deleting,  setDeleting]  = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmBoard, setConfirmBoard] = useState(null)
  const [toast, setToast] = useState(null)

  const tier  = profile?.membership_tier || 'free'
  const limit = TIER_LIMITS[tier]

  // lv2+: 내보내기 가능 / lv3+: 자유롭게
  const canExport   = tier === 'lv2' || tier === 'lv3' || tier === 'master'
  const exportFree  = tier === 'lv3' || tier === 'master'

  // ── 사용량 로드 ──
  const loadCounts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const results = await Promise.all(
      BOARDS.map(b =>
        supabase.from(b.key).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      )
    )
    const c = {}
    BOARDS.forEach((b, i) => { c[b.key] = results[i].count || 0 })
    setCounts(c)
    setLoading(false)
  }, [user])

  useEffect(() => { loadCounts() }, [loadCounts])

  const total  = useMemo(() => BOARDS.reduce((s, b) => s + (counts[b.key] || 0), 0), [counts])
  const pct    = limit ? Math.min((total / limit) * 100, 100) : 0
  const barColor = getBarColor(pct)
  const maxBoard = Math.max(...BOARDS.map(b => counts[b.key] || 0), 1)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 전체 삭제 실행 ──
  const handleDelete = async () => {
    if (!confirmBoard) return
    setDeleting(true)
    const { error } = await supabase.rpc('delete_my_board_data', { p_table: confirmBoard.key })
    setDeleting(false)
    setConfirmBoard(null)
    if (error) {
      showToast('삭제 중 오류가 발생했어요.', 'error')
    } else {
      showToast(`${confirmBoard.label} 데이터를 모두 삭제했어요.`)
      loadCounts()
    }
  }

  // ── JSON 내보내기 ──
  const handleExport = async () => {
    if (!user || !canExport) return
    setExporting(true)
    try {
      const results = await Promise.all(
        BOARDS.map(b =>
          supabase.from(b.key).select('*').eq('user_id', user.id).limit(10000)
        )
      )
      const dataObj = {}
      BOARDS.forEach((b, i) => { dataObj[b.key] = results[i].data || [] })

      const payload = {
        exported_at: new Date().toISOString(),
        user: {
          display_name:    profile?.display_name || '',
          username:        profile?.username     || '',
          membership_tier: TIER_LABEL[tier]      || tier,
        },
        summary: {
          total,
          boards: Object.fromEntries(BOARDS.map(b => [b.key, counts[b.key] || 0])),
        },
        data: dataObj,
      }

      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `trpg_diary_backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('데이터를 내보냈어요.')
    } catch {
      showToast('내보내기 중 오류가 발생했어요.', 'error')
    }
    setExporting(false)
  }

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-light)', fontSize: '0.88rem' }}>불러오는 중...</div>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 680, margin: '0 auto', padding: '20px 0 60px' }}>

      {/* 헤더 */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">
          <Mi style={{ marginRight: 8, verticalAlign: 'middle' }}>storage</Mi>
          데이터 관리
        </h1>
        <p className="page-subtitle">내 게시판 사용량을 확인하고 데이터를 정리해요</p>
      </div>

      {/* ① 사용량 요약 카드 */}
      <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 5 }}>
              현재 등급 · <strong>{TIER_LABEL[tier]}</strong>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.6rem', color: 'var(--color-accent)', lineHeight: 1 }}>
              {total.toLocaleString()}
              <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-light)', marginLeft: 5 }}>
                / {limit ? limit.toLocaleString() : '무제한'}개
              </span>
            </div>
          </div>
          {limit && (
            <div style={{
              padding: '5px 14px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 700,
              background: pct >= 90 ? '#fdecea' : pct >= 70 ? '#fff3e0' : 'var(--color-nav-active-bg)',
              color: pct >= 90 ? '#e53935' : pct >= 70 ? '#fb8c00' : 'var(--color-primary)',
              border: `1px solid ${pct >= 90 ? '#ef9a9a' : pct >= 70 ? '#ffcc80' : 'var(--color-border)'}`,
            }}>
              {pct.toFixed(1)}% 사용 중
            </div>
          )}
        </div>

        {limit ? (
          <>
            <div style={{ background: 'var(--color-border)', borderRadius: 99, height: 14, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 99,
                background: barColor, transition: 'width 0.5s',
              }} />
            </div>
            {pct >= 90 && (
              <p style={{ fontSize: '0.8rem', color: '#e53935', marginTop: 4 }}>
                ⚠️ 용량이 거의 찼어요. 데이터를 정리하거나 후원을 통해 용량을 늘려보세요!
              </p>
            )}
            {pct >= 70 && pct < 90 && (
              <p style={{ fontSize: '0.8rem', color: '#fb8c00', marginTop: 4 }}>
                📦 용량의 70% 이상을 사용 중이에요. 여유 있을 때 정리해두세요.
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
            마스터 등급은 사용량 제한이 없어요 🎉
          </p>
        )}

        {/* 등급별 한도 안내 */}
        <div style={{
          marginTop: 18, padding: '12px 16px', borderRadius: 10,
          background: 'var(--color-nav-active-bg)',
          border: '1px solid var(--color-border)',
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          {[
            { tier: 'free', label: '일반', limit: 1000 },
            { tier: 'lv1',  label: '♥',    limit: 3000 },
            { tier: 'lv2',  label: '♥♥',   limit: 5000 },
            { tier: 'lv3',  label: '♥♥♥',  limit: 8000 },
          ].map(t => (
            <div key={t.tier} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: '1 1 60px',
              opacity: tier === t.tier ? 1 : 0.5,
            }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700,
                color: tier === t.tier ? 'var(--color-primary)' : 'var(--color-text-light)',
              }}>
                {t.label}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                {t.limit.toLocaleString()}개
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ② 게시판별 사용량 */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 18, color: 'var(--color-accent)' }}>
          게시판별 사용량
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {BOARDS.map(b => {
            const cnt  = counts[b.key] || 0
            const bPct = maxBoard > 0 ? (cnt / maxBoard) * 100 : 0
            return (
              <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text)', minWidth: 110, flexShrink: 0 }}>
                  {b.label}
                </span>
                <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${bPct}%`, height: '100%', borderRadius: 99,
                    background: 'var(--color-primary)', transition: 'width 0.4s',
                    minWidth: cnt > 0 ? 4 : 0,
                  }} />
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', minWidth: 46, textAlign: 'right', flexShrink: 0 }}>
                  {cnt.toLocaleString()}개
                </span>
                <button
                  className="btn btn-sm btn-outline"
                  style={{
                    fontSize: '0.7rem', padding: '3px 10px', flexShrink: 0,
                    color: cnt > 0 ? '#e53935' : 'var(--color-text-light)',
                    borderColor: cnt > 0 ? '#ef9a9a' : 'var(--color-border)',
                    cursor: cnt > 0 ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => cnt > 0 && setConfirmBoard(b)}
                  disabled={cnt === 0}
                >
                  전체 삭제
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ③ 데이터 내보내기 */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-accent)', margin: 0 }}>
            데이터 내보내기
          </h3>
          {canExport && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 99,
              background: exportFree ? 'var(--color-nav-active-bg)' : 'var(--color-nav-active-bg)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-border)',
            }}>
              {exportFree ? '풀하트 · 자유 내보내기' : '투하트 · 수동 내보내기'}
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', marginBottom: 16 }}>
          {canExport
            ? '내 모든 게시판 데이터를 JSON 파일로 내보낼 수 있어요.'
            : '♥♥ 투하트 이상 후원자에게 제공되는 기능이에요.'}
        </p>

        {canExport ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExport}
            disabled={exporting || total === 0}
          >
            <Mi size="sm">download</Mi>
            {exporting ? '내보내는 중...' : 'JSON으로 내보내기'}
          </button>
        ) : (
          <Link to="/settings" state={{ tab: 'donation' }} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: 'var(--color-nav-active-bg)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-light)', fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}>
              <Mi size="sm" color="light">lock</Mi>
              투하트 이상 후원 시 이용 가능 · 후원 페이지로 이동 →
            </div>
          </Link>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {confirmBoard && (
        <ConfirmModal
          board={confirmBoard}
          count={counts[confirmBoard.key] || 0}
          onConfirm={handleDelete}
          onCancel={() => setConfirmBoard(null)}
          loading={deleting}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#e53935' : 'var(--color-accent)',
          color: '#fff', padding: '10px 22px', borderRadius: 10,
          fontSize: '0.85rem', zIndex: 9999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
