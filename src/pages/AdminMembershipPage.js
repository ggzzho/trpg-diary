// src/pages/AdminMembershipPage.js
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { membershipApi } from '../lib/supabase'
import { Mi } from '../components/Mi'

// ── 등급 메타 ────────────────────────────────────────────────
const TIER_META = {
  free: { label: '일반',      color: '#7a6050', bg: 'rgba(122,96,80,0.10)',  icon: 'person' },
  lv1:  { label: '후원 Lv.1', color: '#43a047', bg: 'rgba(67,160,71,0.10)', icon: 'favorite' },
  lv2:  { label: '후원 Lv.2', color: '#1976d2', bg: 'rgba(25,118,210,0.10)',icon: 'stars' },
  lv3:  { label: '후원 Lv.3', color: '#c8a96e', bg: 'rgba(200,169,110,0.12)',icon: 'workspace_premium' },
}
const TIERS = ['free', 'lv1', 'lv2', 'lv3']

// KST 포맷 (yyyy-MM-dd HH:mm)
const fmtKST = (iso) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// 만료까지 남은 일수 계산
const daysLeft = (iso) => {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function TierBadge({ tier }) {
  const m = TIER_META[tier] || TIER_META.free
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.78rem', fontWeight: 700,
      color: m.color, background: m.bg,
      padding: '3px 10px', borderRadius: 100,
    }}>
      <Mi size="sm">{m.icon}</Mi>{m.label}
    </span>
  )
}

export default function AdminMembershipPage() {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // ── 이중 보안 검증 ──────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && profile?.is_admin !== true) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, profile, navigate])

  // ── 검색 ────────────────────────────────────────────────────
  const [searchEmail, setSearchEmail]   = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching]       = useState(false)
  const [searchError, setSearchError]   = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResult(null)
    const { data, error } = await membershipApi.searchUser(searchEmail.trim())
    setSearching(false)
    if (error) { setSearchError(error.message || '검색 중 오류가 발생했어요'); return }
    if (!data)  { setSearchError('해당 이메일의 유저를 찾을 수 없어요'); return }
    setSearchResult(data)
    setSelectedTier(data.membership_tier || 'free')
    setNote('')
  }

  // ── 등급 변경 ────────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState('free')
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')
  const [confirmOpen, setConfirmOpen]   = useState(false)

  const handleSave = async () => {
    if (!searchResult) return
    setSaving(true)
    setSaveMsg('')
    const { data, error } = await membershipApi.setMembership(
      searchResult.email,
      selectedTier,
      note.trim() || null,
    )
    setSaving(false)
    setConfirmOpen(false)
    if (error) { setSaveMsg('❌ ' + (error.message || '저장 실패')); return }
    setSearchResult(data)
    setSelectedTier(data.membership_tier || 'free')
    setNote('')
    setSaveMsg('✅ 등급이 변경되었어요')
    loadLogs()
  }

  // ── 변경 내역 ────────────────────────────────────────────────
  const [logs, setLogs]             = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [revertingId, setRevertingId] = useState(null)
  const [revertMsg, setRevertMsg]   = useState('')

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await membershipApi.getLogs(30)
    setLogs(data || [])
    setLogsLoading(false)
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleRevert = async (logId) => {
    if (!window.confirm('이 변경을 되돌리시겠어요? 해당 유저의 등급이 변경 전 상태로 복원됩니다.')) return
    setRevertingId(logId)
    setRevertMsg('')
    const { data, error } = await membershipApi.revertLog(logId)
    setRevertingId(null)
    if (error) { setRevertMsg('❌ ' + (error.message || '되돌리기 실패')); return }
    setRevertMsg('✅ 되돌리기 완료')
    loadLogs()
    // 현재 검색 결과가 같은 유저면 갱신
    if (searchResult && data && searchResult.id === data.id) {
      setSearchResult(data)
      setSelectedTier(data.membership_tier || 'free')
    }
  }

  // ── 만료일 차이 표시 ─────────────────────────────────────────
  const renderExpiryBadge = (tier, expiresAt) => {
    if (tier === 'free' || !expiresAt) return <span style={{ color: 'var(--color-text-light)', fontSize: '0.78rem' }}>-</span>
    const days = daysLeft(expiresAt)
    const color = days < 0 ? '#e57373' : days <= 7 ? '#f57c00' : '#43a047'
    return (
      <span style={{ fontSize: '0.78rem', color }}>
        {fmtKST(expiresAt)}
        <span style={{ marginLeft: 6, fontWeight: 700 }}>
          {days < 0 ? `(${Math.abs(days)}일 초과)` : days === 0 ? '(오늘 만료)' : `(${days}일 남음)`}
        </span>
      </span>
    )
  }

  if (authLoading) return null

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <Mi style={{ marginRight: 8, verticalAlign: 'middle' }}>workspace_premium</Mi>
          멤버십 관리
        </h1>
        <p className="page-subtitle">후원 등급 조회·부여·변경 — 관리자 전용 페이지</p>
      </div>

      {/* ── 유저 검색 ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14, color: 'var(--color-text)' }}>
          <Mi size="sm" style={{ marginRight: 6, verticalAlign: 'middle' }}>search</Mi>유저 검색
        </h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            type="email"
            placeholder="이메일 주소 입력 (정확하게 입력하세요)"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            style={{ flex: 1 }}
            autoComplete="off"
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={searching}>
            {searching ? '검색 중...' : '검색'}
          </button>
        </form>
        {searchError && (
          <p style={{ marginTop: 10, fontSize: '0.83rem', color: '#e57373' }}>{searchError}</p>
        )}
      </div>

      {/* ── 검색 결과 + 등급 변경 ─────────────────────────────── */}
      {searchResult && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
            <Mi size="sm" style={{ marginRight: 6, verticalAlign: 'middle' }}>manage_accounts</Mi>
            유저 정보 및 등급 변경
          </h3>

          {/* 유저 정보 그리드 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '10px 24px', marginBottom: 20,
            padding: '14px 16px', borderRadius: 8,
            background: 'var(--color-nav-active-bg)',
            border: '1px solid var(--color-border)',
          }}>
            {[
              ['이메일',        searchResult.email],
              ['닉네임',        searchResult.display_name || '-'],
              ['아이디',        searchResult.username ? `@${searchResult.username}` : '-'],
              ['가입일',        fmtKST(searchResult.created_at)],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{val}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 4 }}>현재 등급</div>
              <TierBadge tier={searchResult.membership_tier || 'free'} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 2 }}>만료일 (KST)</div>
              {renderExpiryBadge(searchResult.membership_tier, searchResult.membership_expires_at)}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 2 }}>혜택 최초 사용일</div>
              <div style={{ fontSize: '0.83rem', color: searchResult.membership_first_used_at ? '#e57373' : 'var(--color-text-light)', fontWeight: searchResult.membership_first_used_at ? 600 : 400 }}>
                {searchResult.membership_first_used_at ? `⚠️ ${fmtKST(searchResult.membership_first_used_at)} (환불 불가)` : '미사용 (7일 내 전액 환불 가능)'}
              </div>
            </div>
          </div>

          {/* 등급 변경 폼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, display: 'block' }}>
                변경할 등급
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TIERS.map(t => {
                  const m = TIER_META[t]
                  const isSelected = selectedTier === t
                  const isCurrent  = (searchResult.membership_tier || 'free') === t
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedTier(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        border: isSelected ? `2px solid ${m.color}` : '2px solid var(--color-border)',
                        background: isSelected ? m.bg : 'transparent',
                        color: isSelected ? m.color : 'var(--color-text-light)',
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: '0.85rem',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Mi size="sm">{m.icon}</Mi>
                      {m.label}
                      {isCurrent && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>(현재)</span>}
                    </button>
                  )
                })}
              </div>

              {/* 연장 로직 안내 */}
              {selectedTier !== 'free' && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                  {(() => {
                    const cur = searchResult.membership_tier || 'free'
                    const exp = searchResult.membership_expires_at
                    const dl  = exp ? daysLeft(exp) : null
                    if (cur === 'free' || !exp || dl <= 0) {
                      return '오늘부터 31일 후 만료됩니다.'
                    }
                    const newExp = new Date(exp)
                    newExp.setDate(newExp.getDate() + 31)
                    return `기존 만료일(${fmtKST(exp)})에서 31일 연장 → ${fmtKST(newExp.toISOString())}`
                  })()}
                </div>
              )}
              {selectedTier === 'free' && (searchResult.membership_tier || 'free') !== 'free' && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(229,115,115,0.08)', border: '1px solid rgba(229,115,115,0.25)', fontSize: '0.78rem', color: '#e57373' }}>
                  ⚠️ 즉시 일반 등급으로 강등됩니다. 기존 만료일이 제거됩니다.
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6, display: 'block' }}>
                메모 (선택)
              </label>
              <input
                className="form-input"
                placeholder="예: 2026-04 포스타입 구독 확인"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-primary"
                disabled={saving || selectedTier === (searchResult.membership_tier || 'free')}
                onClick={() => setConfirmOpen(true)}
              >
                <Mi size="sm">save</Mi>등급 저장
              </button>
              {saveMsg && (
                <span style={{ fontSize: '0.83rem', color: saveMsg.startsWith('✅') ? '#43a047' : '#e57373' }}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 저장 확인 다이얼로그 ──────────────────────────────── */}
      {confirmOpen && searchResult && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setConfirmOpen(false)}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 14, padding: '28px 24px',
            maxWidth: 380, width: '100%', border: '1px solid var(--color-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>등급 변경 확인</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', lineHeight: 1.7, marginBottom: 20 }}>
              <strong style={{ color: 'var(--color-text)' }}>{searchResult.email}</strong><br />
              <TierBadge tier={searchResult.membership_tier || 'free'} />
              <Mi size="sm" style={{ margin: '0 8px', verticalAlign: 'middle' }}>arrow_forward</Mi>
              <TierBadge tier={selectedTier} />
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setConfirmOpen(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 최근 수정 내역 ────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
            <Mi size="sm" style={{ marginRight: 6, verticalAlign: 'middle' }}>history</Mi>
            최근 수정 내역 (최근 30건)
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={loadLogs} disabled={logsLoading}>
            <Mi size="sm">refresh</Mi>
          </button>
        </div>

        {revertMsg && (
          <p style={{ fontSize: '0.83rem', color: revertMsg.startsWith('✅') ? '#43a047' : '#e57373', marginBottom: 12 }}>
            {revertMsg}
          </p>
        )}

        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
            불러오는 중...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
            아직 수정 내역이 없어요
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['일시 (KST)', '대상 이메일', '변경 전', '변경 후', '새 만료일 (KST)', '메모', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-nav-active-bg)' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-text-light)' }}>
                      {fmtKST(log.created_at)}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {log.target_email}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <TierBadge tier={log.prev_tier || 'free'} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <TierBadge tier={log.new_tier} />
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                      {log.new_expires_at ? fmtKST(log.new_expires_at) : '-'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-light)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.note || '-'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {!log.note?.startsWith('[되돌리기]') && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.72rem', padding: '2px 8px', color: '#f57c00' }}
                          onClick={() => handleRevert(log.id)}
                          disabled={revertingId === log.id}
                        >
                          {revertingId === log.id ? '처리 중...' : '되돌리기'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
