// src/pages/AdminMembershipPage.js
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { membershipApi, supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'

// ── 등급 메타 ─────────────────────────────────────────────────
const TIER_META = {
  master: { label: '마스터',    color: '#9c27b0', bg: 'rgba(156,39,176,0.10)', icon: 'shield_person' },
  free:   { label: '일반',      color: '#7a6050', bg: 'rgba(122,96,80,0.10)',  icon: 'person' },
  '1ht':  { label: '♥',   color: '#43a047', bg: 'rgba(67,160,71,0.10)', icon: 'favorite' },
  '2ht':  { label: '♥♥',  color: '#1976d2', bg: 'rgba(25,118,210,0.10)',icon: 'stars' },
  '3ht':  { label: '♥♥♥', color: '#c8a96e', bg: 'rgba(200,169,110,0.12)',icon: 'workspace_premium' },
}
const ASSIGNABLE_TIERS = ['free', '1ht', '2ht', '3ht'] // master는 DB 직접 설정만 가능

const fmtKST = (iso) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const daysLeft = (iso) => {
  if (!iso) return null
  return Math.ceil((new Date(iso) - new Date()) / 86400000)
}

function TierBadge({ tier }) {
  const m = TIER_META[tier] || TIER_META.free
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.75rem', fontWeight: 700,
      color: m.color, background: m.bg,
      padding: '2px 9px', borderRadius: 100, whiteSpace: 'nowrap',
    }}>
      <Mi size="sm">{m.icon}</Mi>{m.label}
    </span>
  )
}

function ExpiryCell({ tier, expiresAt }) {
  if (tier === 'free' || tier === 'master' || !expiresAt) {
    return <span style={{ color: 'var(--color-text-light)', fontSize: '0.78rem' }}>-</span>
  }
  const days = daysLeft(expiresAt)
  const color = days < 0 ? '#e57373' : days <= 7 ? '#f57c00' : 'var(--color-text-light)'
  return (
    <span style={{ fontSize: '0.78rem', color }}>
      {fmtKST(expiresAt)}
      <span style={{ marginLeft: 5, fontWeight: 700 }}>
        {days < 0 ? `(${Math.abs(days)}일 초과)` : days === 0 ? '(오늘)' : `(${days}일)`}
      </span>
    </span>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function AdminMembershipPage() {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('search') // 'search' | 'list' | 'notify'

  // 이중 보안 검증
  useEffect(() => {
    if (!authLoading && profile?.is_admin !== true) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, profile, navigate])

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

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['search', 'search',           '유저 검색·등급 변경'],
          ['list',   'group',            '전체 회원 목록'],
          ['notify', 'notifications',    '알림 발송'],
        ].map(([v, icon, label]) => (
          <button key={v}
            className={`btn btn-sm ${tab === v ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(v)}>
            <Mi size="sm">{icon}</Mi>{label}
          </button>
        ))}
      </div>

      {tab === 'search' ? <SearchTab /> : tab === 'list' ? <ListTab /> : <NotifyTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 1: 유저 검색 + 등급 변경
// ══════════════════════════════════════════════════════════════
function SearchTab() {
  const [searchEmail, setSearchEmail]       = useState('')
  const [searchCandidates, setSearchCandidates] = useState([])  // 검색 결과 목록
  const [searchResult, setSearchResult]     = useState(null)    // 선택된 유저
  const [searching, setSearching]           = useState(false)
  const [searchError, setSearchError]       = useState('')

  const [selectedTier, setSelectedTier] = useState('free')
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState('')
  const [confirmOpen, setConfirmOpen]   = useState(false)

  const [extendConfirmOpen, setExtendConfirmOpen] = useState(false)

  const [logs, setLogs]               = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [revertingId, setRevertingId] = useState(null)
  const [revertMsg, setRevertMsg]     = useState('')

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await membershipApi.getLogs(30)
    setLogs(data || [])
    setLogsLoading(false)
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchCandidates([])
    setSearchResult(null)
    setSaveMsg('')
    const { data, error } = await membershipApi.searchUser(searchEmail.trim())
    setSearching(false)
    if (error) { setSearchError(error.message || '검색 중 오류'); return }
    const list = Array.isArray(data) ? data : (data ? [data] : [])
    if (list.length === 0) { setSearchError('해당 이메일의 유저를 찾을 수 없어요'); return }
    if (list.length === 1) {
      // 결과가 1명이면 바로 선택
      setSearchResult(list[0])
      setSelectedTier(list[0].membership_tier || 'free')
      setNote('')
    } else {
      // 여러 명이면 목록 표시
      setSearchCandidates(list)
    }
  }

  const handleSelectCandidate = (user) => {
    setSearchCandidates([])
    setSearchResult(user)
    setSelectedTier(user.membership_tier || 'free')
    setNote('')
    setSaveMsg('')
  }

  const handleSave = async () => {
    if (!searchResult) return
    setSaving(true); setSaveMsg('')
    const { data, error } = await membershipApi.setMembership(
      searchResult.email, selectedTier, note.trim() || null
    )
    setSaving(false); setConfirmOpen(false)
    if (error) { setSaveMsg('❌ ' + (error.message || '저장 실패')); return }
    setSearchResult(data)
    setSelectedTier(data.membership_tier || 'free')
    setNote('')
    setSaveMsg('✅ 등급이 변경되었어요')
    loadLogs()
  }

  const handleExtend = async () => {
    if (!searchResult) return
    setSaving(true); setSaveMsg('')
    const { data, error } = await membershipApi.setMembership(
      searchResult.email, currentTier, '[연장] +31일'
    )
    setSaving(false); setExtendConfirmOpen(false)
    if (error) { setSaveMsg('❌ ' + (error.message || '연장 실패')); return }
    setSearchResult(data)
    setSelectedTier(data.membership_tier || 'free')
    setSaveMsg('✅ 31일 연장 완료')
    loadLogs()
  }

  const handleRevert = async (logId) => {
    if (!window.confirm('이 변경을 되돌리시겠어요?')) return
    setRevertingId(logId); setRevertMsg('')
    const { data, error } = await membershipApi.revertLog(logId)
    setRevertingId(null)
    if (error) { setRevertMsg('❌ ' + (error.message || '되돌리기 실패')); return }
    setRevertMsg('✅ 되돌리기 완료')
    loadLogs()
    if (searchResult && data && searchResult.id === data.id) {
      setSearchResult(data)
      setSelectedTier(data.membership_tier || 'free')
    }
  }

  const isMaster = searchResult?.membership_tier === 'master'
  const currentTier = searchResult?.membership_tier || 'free'

  return (
    <>
      {/* 검색 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>
          <Mi size="sm" style={{ marginRight: 6, verticalAlign: 'middle' }}>search</Mi>유저 검색
        </h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            type="text"
            placeholder="이메일 / 닉네임 / 아이디 검색 (최대 10명 표시)"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            style={{ flex: 1 }}
            autoComplete="off"
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={searching}>
            {searching ? '검색 중...' : '검색'}
          </button>
        </form>
        {searchError && <p style={{ marginTop: 10, fontSize: '0.83rem', color: '#e57373' }}>{searchError}</p>}

        {/* 다중 결과 목록 */}
        {searchCandidates.length > 1 && (
          <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'var(--color-nav-active-bg)', fontSize: '0.78rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
              {searchCandidates.length}명 검색됨 — 클릭해서 선택하세요
            </div>
            {searchCandidates.map((u, i) => (
              <button key={u.id} onClick={() => handleSelectCandidate(u)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', textAlign: 'left', border: 'none', cursor: 'pointer',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                  background: 'transparent', transition: 'background 0.1s',
                }}>
                <TierBadge tier={u.membership_tier || 'free'} />
                <span style={{ fontWeight: 600, fontSize: '0.88rem', flex: 1 }}>{u.email}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                  {u.display_name || u.username || '-'}
                </span>
                <Mi size="sm" style={{ color: 'var(--color-text-light)' }}>chevron_right</Mi>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 검색 결과 */}
      {searchResult && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>
            <Mi size="sm" style={{ marginRight: 6, verticalAlign: 'middle' }}>manage_accounts</Mi>
            유저 정보
            {isMaster && (
              <span style={{ marginLeft: 10, fontSize: '0.75rem', color: '#9c27b0', fontWeight: 600 }}>
                ⚠️ 마스터 계정 — 등급 변경 잠금
              </span>
            )}
          </h3>

          {/* 유저 정보 그리드 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px',
            marginBottom: isMaster ? 0 : 20, padding: '14px 16px', borderRadius: 8,
            background: isMaster ? 'rgba(156,39,176,0.05)' : 'var(--color-nav-active-bg)',
            border: `1px solid ${isMaster ? 'rgba(156,39,176,0.25)' : 'var(--color-border)'}`,
          }}>
            {[['이메일', searchResult.email], ['닉네임', searchResult.display_name || '-'],
              ['아이디', searchResult.username ? `@${searchResult.username}` : '-'],
              ['가입일', fmtKST(searchResult.created_at)]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{val}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 4 }}>현재 등급</div>
              <TierBadge tier={currentTier} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 2 }}>만료일 (KST)</div>
              <ExpiryCell tier={currentTier} expiresAt={searchResult.membership_expires_at} />
            </div>
            {/* 만료일 연장 버튼 */}
            {!isMaster && currentTier !== 'free' && (
              <div style={{ gridColumn: '1 / -1', marginTop: 2 }}>
                <button className="btn btn-sm btn-outline"
                  onClick={() => setExtendConfirmOpen(true)}
                  style={{ fontSize: '0.78rem', color: '#1976d2', borderColor: '#1976d2aa' }}>
                  <Mi size="sm">add_circle</Mi>만료일 +31일 연장
                </button>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginBottom: 2 }}>혜택 최초 사용일</div>
              <div style={{ fontSize: '0.83rem', color: searchResult.membership_first_used_at ? '#e57373' : 'var(--color-text-light)', fontWeight: searchResult.membership_first_used_at ? 600 : 400 }}>
                {searchResult.membership_first_used_at
                  ? `⚠️ ${fmtKST(searchResult.membership_first_used_at)} (환불 불가)`
                  : '미사용 (7일 내 전액 환불 가능)'}
              </div>
            </div>
          </div>

          {/* 등급 변경 폼 — master 계정은 숨김 */}
          {!isMaster && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>
                  변경할 등급
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ASSIGNABLE_TIERS.map(t => {
                    const m = TIER_META[t]
                    const isSelected = selectedTier === t
                    const isCurrent  = currentTier === t
                    return (
                      <button key={t} onClick={() => setSelectedTier(t)} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        border: isSelected ? `2px solid ${m.color}` : '2px solid var(--color-border)',
                        background: isSelected ? m.bg : 'transparent',
                        color: isSelected ? m.color : 'var(--color-text-light)',
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: '0.85rem', transition: 'all 0.15s',
                      }}>
                        <Mi size="sm">{m.icon}</Mi>{m.label}
                        {isCurrent && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>(현재)</span>}
                      </button>
                    )
                  })}
                </div>

                {/* 연장 예상 안내 */}
                {selectedTier !== 'free' && (() => {
                  const exp = searchResult.membership_expires_at
                  const dl  = exp ? daysLeft(exp) : null
                  if (currentTier === 'free' || !exp || dl <= 0) {
                    return <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>오늘부터 31일 후 만료됩니다.</div>
                  }
                  const newExp = new Date(exp); newExp.setDate(newExp.getDate() + 31)
                  return <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                    기존 만료일({fmtKST(exp)})에서 31일 연장 → {fmtKST(newExp.toISOString())}
                  </div>
                })()}
                {selectedTier === 'free' && currentTier !== 'free' && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(229,115,115,0.08)', border: '1px solid rgba(229,115,115,0.25)', fontSize: '0.78rem', color: '#e57373' }}>
                    ⚠️ 즉시 일반 등급으로 강등됩니다. 기존 만료일이 제거됩니다.
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>메모 (선택)</label>
                <input className="form-input" placeholder="예: 2026-04 포스타입 구독 확인"
                  value={note} onChange={e => setNote(e.target.value)} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn btn-primary"
                  disabled={saving || selectedTier === currentTier}
                  onClick={() => setConfirmOpen(true)}>
                  <Mi size="sm">save</Mi>등급 저장
                </button>
                {saveMsg && (
                  <span style={{ fontSize: '0.83rem', color: saveMsg.startsWith('✅') ? '#43a047' : '#e57373' }}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 확인 다이얼로그 */}
      {confirmOpen && searchResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmOpen(false)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '28px 24px', maxWidth: 380, width: '100%', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>등급 변경 확인</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', lineHeight: 1.7, marginBottom: 20 }}>
              <strong style={{ color: 'var(--color-text)' }}>{searchResult.email}</strong><br />
              <TierBadge tier={currentTier} />
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

      {/* 연장 확인 다이얼로그 */}
      {extendConfirmOpen && searchResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setExtendConfirmOpen(false)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '28px 24px', maxWidth: 380, width: '100%', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>만료일 +31일 연장</h3>
            <div style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', lineHeight: 1.8, marginBottom: 20 }}>
              <strong style={{ color: 'var(--color-text)' }}>{searchResult.email}</strong><br />
              <span>현재 만료일: {fmtKST(searchResult.membership_expires_at) || '없음'}</span><br />
              <span style={{ color: '#1976d2', fontWeight: 600 }}>연장 후: {(() => {
                const exp = searchResult.membership_expires_at
                const base = exp && daysLeft(exp) > 0 ? new Date(exp) : new Date()
                base.setDate(base.getDate() + 31)
                return fmtKST(base.toISOString())
              })()}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setExtendConfirmOpen(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleExtend} disabled={saving}>
                {saving ? '처리 중...' : '+31일 연장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최근 수정 내역 */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            <Mi size="sm" style={{ marginRight: 6, verticalAlign: 'middle' }}>history</Mi>
            최근 수정 내역 (30건)
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={loadLogs} disabled={logsLoading}>
            <Mi size="sm">refresh</Mi>
          </button>
        </div>
        {revertMsg && (
          <p style={{ fontSize: '0.83rem', color: revertMsg.startsWith('✅') ? '#43a047' : '#e57373', marginBottom: 12 }}>{revertMsg}</p>
        )}
        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>불러오는 중...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>수정 내역이 없어요</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['일시 (KST)', '대상 이메일', '변경 전', '변경 후', '새 만료일', '메모', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-nav-active-bg)' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-text-light)' }}>{fmtKST(log.created_at)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{log.target_email}</td>
                    <td style={{ padding: '8px 10px' }}><TierBadge tier={log.prev_tier || 'free'} /></td>
                    <td style={{ padding: '8px 10px' }}><TierBadge tier={log.new_tier} /></td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>{log.new_expires_at ? fmtKST(log.new_expires_at) : '-'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-light)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.note || '-'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {!log.note?.startsWith('[되돌리기]') && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.72rem', padding: '2px 8px', color: '#f57c00' }}
                          onClick={() => handleRevert(log.id)}
                          disabled={revertingId === log.id}>
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
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 3: 알림 발송
// ══════════════════════════════════════════════════════════════
const CONDITION_OPTIONS = [
  { value: 'all',                label: '전체 유저',           icon: 'groups',         warn: true },
  { value: 'free',               label: '일반',                icon: 'person' },
  { value: '1ht',                label: '♥ 원하트',            icon: 'favorite' },
  { value: '2ht',                label: '♥♥ 투하트',           icon: 'stars' },
  { value: '3ht',                label: '♥♥♥ 풀하트',          icon: 'workspace_premium' },
  { value: 'master',             label: '마스터',               icon: 'shield_person' },
  { value: 'wish_scenario_users',label: '위시 시나리오 등록',   icon: 'bookmark_add' },
  { value: 'storage_over',       label: '데이터 한도 초과',     icon: 'error_outline' },
  { value: 'storage_80',         label: '데이터 80% 이상',      icon: 'data_usage' },
]

function NotifyTab() {
  const [mode, setMode]               = useState('condition') // 'condition' | 'manual'

  // ── A. 조건 선택 ──
  const [condition, setCondition]       = useState(null)
  const [condUsers, setCondUsers]       = useState(null)    // { users:[{id,username,display_name}], total }
  const [condSelected, setCondSelected] = useState(new Set()) // 체크된 uid Set
  const [condLoading, setCondLoading]   = useState(false)
  const [condError, setCondError]       = useState('')

  // ── B. 직접 선택 ──
  const [manualInput, setManualInput]   = useState('')
  const [manualResults, setManualResults] = useState([])
  const [manualSearching, setManualSearching] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([]) // [{id,username,display_name}]

  // ── 메시지 ──
  const [message, setMessage]   = useState('')
  const [refUrl, setRefUrl]     = useState('')

  // ── 발송 ──
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sending, setSending]         = useState(false)
  const [sendResult, setSendResult]   = useState(null) // null | {ok, count} | {error}

  // ── 발송 이력 ──
  const [broadcasts, setBroadcasts]             = useState([])
  const [broadcastsLoading, setBroadcastsLoading] = useState(false)
  const [expandedId, setExpandedId]             = useState(null)

  const loadBroadcasts = useCallback(async () => {
    setBroadcastsLoading(true)
    const { data } = await supabase
      .from('notification_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    setBroadcastsLoading(false)
    setBroadcasts(data || [])
  }, [])

  useEffect(() => { loadBroadcasts() }, [loadBroadcasts])

  const targets = mode === 'condition'
    ? [...condSelected]
    : selectedUsers.map(u => u.id)

  // ── 조건 조회 ──
  const handleConditionQuery = async () => {
    if (!condition) return
    setCondLoading(true); setCondError(''); setCondUsers(null); setCondSelected(new Set())
    const { data, error } = await supabase.rpc('admin_get_condition_users', { p_condition: condition })
    setCondLoading(false)
    if (error) { setCondError(error.message || '조회 실패'); return }
    const rows = (data || []).map(r => ({ id: r.uid, username: r.uname, display_name: r.udname }))
    setCondUsers({ users: rows, total: rows.length })
    setCondSelected(new Set(rows.map(r => r.id))) // 기본: 전체 선택
  }

  const toggleCondUser = (id) => {
    setCondSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 수동 검색 ──
  const handleManualSearch = async (e) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    setManualSearching(true)
    const { data, error } = await membershipApi.searchUser(manualInput.trim())
    setManualSearching(false)
    if (error) { setManualResults([]); return }
    const list = Array.isArray(data) ? data : (data ? [data] : [])
    setManualResults(list)
  }

  const toggleSelect = (user) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id)
      if (exists) return prev.filter(u => u.id !== user.id)
      return [...prev, { id: user.id, username: user.username, display_name: user.display_name }]
    })
  }

  const isSelected = (id) => selectedUsers.some(u => u.id === id)

  // ── 발송 ──
  const handleSend = async () => {
    if (!targets.length || !message.trim()) return
    setSending(true); setSendResult(null)
    const condLabel = mode === 'condition'
      ? (condMeta?.label || condition || '조건 선택')
      : `직접 선택 ${targets.length}명`
    const { data, error } = await supabase.rpc('admin_send_notifications', {
      target_ids:        targets,
      p_message:         message.trim(),
      p_type:            'admin_notice',
      p_ref_url:         refUrl.trim() || null,
      p_condition_label: condLabel,
    })
    setSending(false)
    if (error) {
      setSendResult({ error: error.message || '발송 실패' })
    } else {
      setSendResult({ ok: true, count: data })
      setPreviewOpen(false)
      setMessage(''); setRefUrl('')
      if (mode === 'condition') { setCondUsers(null); setCondition(null); setCondSelected(new Set()) }
      else { setSelectedUsers([]); setManualResults([]) }
      loadBroadcasts()
    }
  }

  const condMeta = condition ? CONDITION_OPTIONS.find(o => o.value === condition) : null

  return (
    <>
      {/* 발송 결과 */}
      {sendResult && (
        <div style={{
          padding:'12px 16px', borderRadius:10, marginBottom:16,
          background: sendResult.ok ? 'rgba(67,160,71,0.08)' : 'rgba(229,115,115,0.08)',
          border: `1px solid ${sendResult.ok ? '#43a04755' : '#ef9a9a'}`,
          fontSize:'0.88rem', fontWeight:600,
          color: sendResult.ok ? '#2e7d32' : '#c62828',
          display:'flex', alignItems:'center', gap:8,
        }}>
          <Mi size="sm">{sendResult.ok ? 'check_circle' : 'error'}</Mi>
          {sendResult.ok ? `${sendResult.count}명에게 알림을 발송했습니다.` : `발송 실패: ${sendResult.error}`}
          <button style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit', opacity:0.6, fontSize:'1rem' }}
            onClick={() => setSendResult(null)}>✕</button>
        </div>
      )}

      {/* ── 대상 선택 모드 토글 ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['condition','tune','조건으로 선택'], ['manual','person_search','직접 선택']].map(([v,icon,label]) => (
            <button key={v}
              className={`btn btn-sm ${mode===v?'btn-primary':'btn-outline'}`}
              onClick={() => { setMode(v); setCondUsers(null); setCondition(null); setManualResults([]) }}>
              <Mi size="sm">{icon}</Mi>{label}
            </button>
          ))}
        </div>

        {/* ─ A. 조건 선택 ─ */}
        {mode === 'condition' && (
          <>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              {CONDITION_OPTIONS.map(opt => {
                const m = TIER_META[opt.value]
                const isActive = condition === opt.value
                return (
                  <button key={opt.value}
                    onClick={() => { setCondition(opt.value); setCondUsers(null); setCondError('') }}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:'0.83rem',
                      border: isActive
                        ? `2px solid ${m?.color || 'var(--color-primary)'}`
                        : '2px solid var(--color-border)',
                      background: isActive ? (m?.bg || 'rgba(var(--color-primary-rgb),0.08)') : 'transparent',
                      color: isActive ? (m?.color || 'var(--color-primary)') : 'var(--color-text)',
                      fontWeight: isActive ? 700 : 400,
                      transition:'all 0.15s',
                    }}>
                    <Mi size="sm">{opt.icon}</Mi>{opt.label}
                    {opt.warn && <Mi size="sm" style={{ color:'#f57c00', marginLeft:2 }}>warning</Mi>}
                  </button>
                )
              })}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button className="btn btn-sm btn-outline" onClick={handleConditionQuery}
                disabled={!condition || condLoading}>
                <Mi size="sm">search</Mi>{condLoading ? '조회 중...' : '대상 조회'}
              </button>
              {condError && <span style={{ fontSize:'0.82rem', color:'#e57373' }}>{condError}</span>}
            </div>

            {condUsers && (
              <div style={{ marginTop:14, border:'1px solid var(--color-border)', borderRadius:10, overflow:'hidden' }}>
                {/* 헤더: 전체 선택/해제 */}
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 14px', background:'var(--color-nav-active-bg)',
                  borderBottom:'1px solid var(--color-border)',
                }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'0.85rem', fontWeight:700 }}>
                    <input type="checkbox"
                      checked={condSelected.size === condUsers.total && condUsers.total > 0}
                      onChange={e => setCondSelected(e.target.checked ? new Set(condUsers.users.map(u => u.id)) : new Set())}
                      style={{ width:15, height:15, accentColor:'var(--color-primary)', cursor:'pointer' }}
                    />
                    총 {condUsers.total}명
                    <span style={{ fontWeight:400, color:'var(--color-text-light)', fontSize:'0.78rem' }}>
                      ({condSelected.size}명 선택)
                    </span>
                    {condMeta?.warn && condUsers.total > 100 && (
                      <span style={{ fontSize:'0.75rem', color:'#f57c00', fontWeight:600 }}>
                        ⚠️ 대량 발송
                      </span>
                    )}
                  </label>
                  {condSelected.size !== condUsers.total && condSelected.size > 0 && (
                    <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>
                      {condUsers.total - condSelected.size}명 제외됨
                    </span>
                  )}
                </div>

                {/* 유저 리스트 */}
                <div style={{ maxHeight:260, overflowY:'auto' }}>
                  {condUsers.users.map((u, i) => (
                    <label key={u.id} style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'9px 14px', cursor:'pointer',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                      background: condSelected.has(u.id) ? 'rgba(var(--color-primary-rgb),0.04)' : 'transparent',
                      transition:'background 0.1s',
                    }}>
                      <input type="checkbox"
                        checked={condSelected.has(u.id)}
                        onChange={() => toggleCondUser(u.id)}
                        style={{ width:15, height:15, accentColor:'var(--color-primary)', cursor:'pointer', flexShrink:0 }}
                      />
                      <span style={{ fontSize:'0.85rem', fontWeight: condSelected.has(u.id) ? 600 : 400, flex:1 }}>
                        {u.display_name || u.username || '(이름 없음)'}
                      </span>
                      {u.username && (
                        <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>@{u.username}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─ B. 직접 선택 ─ */}
        {mode === 'manual' && (
          <>
            <form onSubmit={handleManualSearch} style={{ display:'flex', gap:8, marginBottom:12 }}>
              <input className="form-input"
                placeholder="이메일 / 닉네임 / 아이디 검색"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                style={{ flex:1 }}
                autoComplete="off"
              />
              <button className="btn btn-sm btn-outline" type="submit" disabled={manualSearching}>
                {manualSearching ? '...' : '검색'}
              </button>
            </form>

            {manualResults.length > 0 && (
              <div style={{ border:'1px solid var(--color-border)', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
                {manualResults.map((u, i) => (
                  <label key={u.id} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', cursor:'pointer',
                    borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                    background: isSelected(u.id) ? 'rgba(var(--color-primary-rgb),0.06)' : 'transparent',
                    transition:'background 0.1s',
                  }}>
                    <input type="checkbox" checked={isSelected(u.id)}
                      onChange={() => toggleSelect(u)}
                      style={{ width:16, height:16, accentColor:'var(--color-primary)', cursor:'pointer' }} />
                    <TierBadge tier={u.membership_tier || 'free'} />
                    <span style={{ fontWeight:600, fontSize:'0.85rem', flex:1 }}>
                      {u.display_name || u.username || '-'}
                      {u.username && <span style={{ fontSize:'0.75rem', opacity:0.6, marginLeft:5 }}>@{u.username}</span>}
                    </span>
                    <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)' }}>{u.email}</span>
                  </label>
                ))}
              </div>
            )}

            {selectedUsers.length > 0 && (
              <div style={{
                padding:'10px 14px', borderRadius:10,
                background:'var(--color-nav-active-bg)', border:'1px solid var(--color-border)',
              }}>
                <div style={{ fontSize:'0.82rem', fontWeight:700, marginBottom:8, color:'var(--color-primary)' }}>
                  선택된 유저 {selectedUsers.length}명
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {selectedUsers.map(u => (
                    <span key={u.id} style={{
                      display:'flex', alignItems:'center', gap:4,
                      fontSize:'0.78rem', padding:'3px 10px', borderRadius:100,
                      background:'var(--color-surface)', border:'1px solid var(--color-border)',
                    }}>
                      {u.display_name || u.username || '(이름 없음)'}
                      <button onClick={() => setSelectedUsers(p => p.filter(x => x.id !== u.id))}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, color:'var(--color-text-light)', fontSize:'0.9rem' }}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 메시지 작성 ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:'0.9rem', fontWeight:700, marginBottom:14 }}>
          <Mi size="sm" style={{ marginRight:6, verticalAlign:'middle' }}>edit_note</Mi>메시지 작성
        </h3>
        <textarea
          className="form-input"
          rows={4}
          placeholder="알림 메시지 내용을 입력하세요"
          value={message}
          onChange={e => setMessage(e.target.value)}
          style={{ width:'100%', resize:'vertical', fontFamily:'inherit' }}
        />
        <div style={{ marginTop:10 }}>
          <label style={{ fontSize:'0.8rem', color:'var(--color-text-light)', display:'block', marginBottom:5 }}>
            연결 URL (선택)
          </label>
          <input className="form-input"
            placeholder="예: /notices/... 또는 /storage"
            value={refUrl}
            onChange={e => setRefUrl(e.target.value)}
          />
        </div>
      </div>

      {/* ── 미리보기 버튼 ── */}
      <button
        className="btn btn-primary"
        disabled={!targets.length || !message.trim()}
        onClick={() => { setSendResult(null); setPreviewOpen(true) }}>
        <Mi size="sm">visibility</Mi>
        미리보기 확인
        {targets.length > 0 && (
          <span style={{
            marginLeft:6, background:'rgba(255,255,255,0.25)',
            padding:'1px 8px', borderRadius:100, fontSize:'0.78rem',
          }}>
            {targets.length}명
          </span>
        )}
      </button>
      {!targets.length && (
        <p style={{ marginTop:8, fontSize:'0.8rem', color:'var(--color-text-light)' }}>
          대상 유저를 먼저 선택해 주세요.
        </p>
      )}

      {/* ── 미리보기 모달 ── */}
      {previewOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => !sending && setPreviewOpen(false)}>
          <div style={{
            background:'var(--color-surface)', borderRadius:16, padding:'28px 24px',
            maxWidth:460, width:'100%', border:'1px solid var(--color-border)',
            boxShadow:'0 8px 32px rgba(0,0,0,0.22)',
          }} onClick={e => e.stopPropagation()}>

            <h3 style={{ fontWeight:700, marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
              <Mi style={{ color:'var(--color-primary)' }}>notifications</Mi>
              발송 전 최종 확인
            </h3>

            {/* 수신자 */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:'0.75rem', color:'var(--color-text-light)', marginBottom:5, fontWeight:600 }}>
                수신자
              </div>
              <div style={{
                padding:'10px 14px', borderRadius:8,
                background:'var(--color-nav-active-bg)', border:'1px solid var(--color-border)',
              }}>
                <span style={{ fontWeight:700, color:'var(--color-primary)', fontSize:'0.95rem' }}>
                  {targets.length}명
                </span>
                <span style={{ fontSize:'0.82rem', color:'var(--color-text-light)', marginLeft:8 }}>
                  {mode === 'condition' && condMeta ? `(조건: ${condMeta.label})` : '(직접 선택)'}
                </span>
                {(() => {
                  const previewList = mode === 'condition'
                    ? (condUsers?.users || []).filter(u => condSelected.has(u.id))
                    : selectedUsers
                  if (!previewList.length) return null
                  return (
                    <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:4 }}>
                      {previewList.slice(0, 5).map(u => (
                        <span key={u.id} style={{ fontSize:'0.75rem', padding:'2px 8px', borderRadius:100,
                          background:'var(--color-surface)', border:'1px solid var(--color-border)' }}>
                          {u.display_name || u.username}
                        </span>
                      ))}
                      {previewList.length > 5 && (
                        <span style={{ fontSize:'0.75rem', color:'var(--color-text-light)', padding:'2px 4px' }}>
                          외 {previewList.length - 5}명
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* 메시지 */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:'0.75rem', color:'var(--color-text-light)', marginBottom:5, fontWeight:600 }}>
                메시지
              </div>
              <div style={{
                padding:'12px 14px', borderRadius:8, fontSize:'0.88rem', lineHeight:1.6,
                background:'var(--color-nav-active-bg)', border:'1px solid var(--color-border)',
                whiteSpace:'pre-wrap', wordBreak:'break-word',
              }}>
                {message}
              </div>
              {refUrl && (
                <div style={{ marginTop:6, fontSize:'0.78rem', color:'var(--color-text-light)' }}>
                  링크: <code style={{ background:'var(--color-nav-active-bg)', padding:'1px 6px', borderRadius:4 }}>{refUrl}</code>
                </div>
              )}
            </div>

            {sendResult?.error && (
              <p style={{ fontSize:'0.83rem', color:'#e57373', marginBottom:12 }}>
                ❌ {sendResult.error}
              </p>
            )}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setPreviewOpen(false)} disabled={sending}>
                취소
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending}>
                <Mi size="sm">send</Mi>
                {sending ? '발송 중...' : `${targets.length}명에게 발송`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 발송 이력 ── */}
      <div className="card" style={{ marginTop:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ fontSize:'0.9rem', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
            <Mi size="sm" style={{ color:'var(--color-primary)' }}>history</Mi>
            발송 이력
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={loadBroadcasts} disabled={broadcastsLoading}>
            <Mi size="sm">refresh</Mi>{broadcastsLoading ? '...' : '새로고침'}
          </button>
        </div>

        {broadcastsLoading && broadcasts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:'var(--color-text-light)', fontSize:'0.85rem' }}>
            불러오는 중...
          </div>
        ) : broadcasts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:'var(--color-text-light)', fontSize:'0.85rem' }}>
            발송 이력이 없습니다.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {broadcasts.map(b => (
              <div key={b.id} style={{
                border:'1px solid var(--color-border)', borderRadius:10, overflow:'hidden',
              }}>
                {/* 요약 행 */}
                <div
                  onClick={() => setExpandedId(prev => prev === b.id ? null : b.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', cursor:'pointer',
                    background: expandedId === b.id ? 'var(--color-nav-active-bg)' : 'transparent',
                    transition:'background 0.15s',
                  }}>
                  <Mi size="sm" style={{ color:'var(--color-primary)', flexShrink:0 }}>notifications</Mi>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.85rem', fontWeight:600,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {b.message}
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'var(--color-text-light)', marginTop:2, display:'flex', gap:8 }}>
                      <span>{fmtKST(b.created_at)}</span>
                      <span>·</span>
                      <span style={{ color:'var(--color-primary)', fontWeight:600 }}>{b.target_count}명</span>
                      {b.condition_label && <><span>·</span><span>{b.condition_label}</span></>}
                    </div>
                  </div>
                  <Mi size="sm" style={{ color:'var(--color-text-light)', flexShrink:0 }}>
                    {expandedId === b.id ? 'expand_less' : 'expand_more'}
                  </Mi>
                </div>

                {/* 상세 펼침 */}
                {expandedId === b.id && (
                  <div style={{
                    padding:'12px 14px', borderTop:'1px solid var(--color-border)',
                    background:'var(--color-nav-active-bg)',
                  }}>
                    <div style={{ fontSize:'0.75rem', color:'var(--color-text-light)', marginBottom:4, fontWeight:600 }}>메시지 전문</div>
                    <div style={{
                      fontSize:'0.85rem', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word',
                      padding:'10px 12px', borderRadius:8, background:'var(--color-surface)',
                      border:'1px solid var(--color-border)',
                    }}>
                      {b.message}
                    </div>
                    {b.ref_url && (
                      <div style={{ marginTop:8, fontSize:'0.78rem', color:'var(--color-text-light)' }}>
                        링크: <code style={{ background:'var(--color-surface)', padding:'1px 6px', borderRadius:4 }}>{b.ref_url}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 2: 전체 회원 목록
// ══════════════════════════════════════════════════════════════
const TIER_FILTER_OPTIONS = [
  { value: null,     label: '전체' },
  { value: 'master', label: '마스터' },
  { value: '3ht',    label: '♥♥♥' },
  { value: '2ht',    label: '♥♥' },
  { value: '1ht',    label: '♥' },
  { value: 'free',   label: '일반' },
]
const PER_PAGE = 30

function ListTab() {
  const [tierFilter, setTierFilter] = useState(null)
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage]             = useState(1)
  const [result, setResult]         = useState(null)  // { total, rows }
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const searchTimer = useRef(null)

  // 등급 통계 (전체 로드 시)
  const [stats, setStats] = useState(null)

  const load = useCallback(async (p = page, t = tierFilter, s = search) => {
    setLoading(true); setError('')
    const { data, error } = await membershipApi.listUsers({
      tier: t, page: p, perPage: PER_PAGE, search: s || null,
    })
    setLoading(false)
    if (error) { setError(error.message || '불러오기 실패'); return }
    setResult({ total: data.total, rows: data.rows || [] })
  }, []) // eslint-disable-line

  // 등급별 통계 (최초 1회)
  const loadStats = useCallback(async () => {
    const results = await Promise.all(
      ['master','3ht','2ht','1ht','free'].map(t =>
        membershipApi.listUsers({ tier: t, page: 1, perPage: 1 })
      )
    )
    const keys = ['master','3ht','2ht','1ht','free']
    const s = {}
    results.forEach(({ data }, i) => { s[keys[i]] = data?.total || 0 })
    setStats(s)
  }, [])

  useEffect(() => { load(1, null, ''); loadStats() }, []) // eslint-disable-line

  // 검색 디바운스 (500ms)
  const handleSearchChange = (v) => {
    setSearchInput(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(v); setPage(1); load(1, tierFilter, v)
    }, 500)
  }

  const handleTierFilter = (t) => {
    setTierFilter(t); setPage(1); load(1, t, search)
  }

  const handlePage = (p) => {
    setPage(p); load(p, tierFilter, search)
  }

  const totalPages = result ? Math.ceil(result.total / PER_PAGE) : 0

  return (
    <>
      {/* 등급별 통계 카드 */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {['master','3ht','2ht','1ht','free'].map(t => {
            const m = TIER_META[t]
            return (
              <div key={t} style={{
                flex: '1 1 100px', minWidth: 100,
                padding: '12px 16px', borderRadius: 10,
                background: m.bg, border: `1px solid ${m.color}33`,
                cursor: 'pointer',
                outline: tierFilter === t ? `2px solid ${m.color}` : 'none',
              }} onClick={() => handleTierFilter(tierFilter === t ? null : t)}>
                <div style={{ fontSize: '0.72rem', color: m.color, fontWeight: 600, marginBottom: 4 }}>
                  <Mi size="sm" style={{ marginRight: 4, verticalAlign: 'middle' }}>{m.icon}</Mi>
                  {m.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: m.color }}>{stats[t].toLocaleString()}</div>
                <div style={{ fontSize: '0.68rem', color: m.color, opacity: 0.7 }}>명</div>
              </div>
            )
          })}
          <div style={{
            flex: '1 1 100px', minWidth: 100,
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--color-nav-active-bg)', border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', fontWeight: 600, marginBottom: 4 }}>총 회원</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {Object.values(stats).reduce((a, b) => a + b, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-light)' }}>명</div>
          </div>
        </div>
      )}

      {/* 검색 + 필터 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="이메일 / 닉네임 / 아이디 검색"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIER_FILTER_OPTIONS.map(({ value, label }) => (
              <button key={String(value)}
                className={`btn btn-sm ${tierFilter === value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleTierFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.83rem', color: 'var(--color-text-light)' }}>
            {loading ? '불러오는 중...' : result ? `총 ${result.total.toLocaleString()}명` : ''}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => load(page, tierFilter, search)} disabled={loading}>
            <Mi size="sm">refresh</Mi>
          </button>
        </div>

        {error && <p style={{ color: '#e57373', fontSize: '0.83rem', marginBottom: 12 }}>{error}</p>}

        {loading && !result ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>불러오는 중...</div>
        ) : result?.rows?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>검색 결과가 없어요</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['#', '이메일', '닉네임', '등급', '만료일 (KST)', '최초사용일', '가입일'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result?.rows || []).map((user, i) => (
                  <tr key={user.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: user.membership_tier === 'master'
                        ? 'rgba(156,39,176,0.04)'
                        : i % 2 === 0 ? 'transparent' : 'var(--color-nav-active-bg)',
                      opacity: loading ? 0.5 : 1,
                    }}>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-light)', fontSize: '0.75rem' }}>
                      {(page - 1) * PER_PAGE + i + 1}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: user.membership_tier !== 'free' ? 600 : 400 }}>
                      {user.email}
                      {user.is_admin && <Mi size="sm" style={{ marginLeft: 5, color: '#9c27b0', verticalAlign: 'middle' }}>shield_person</Mi>}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-light)' }}>
                      {user.display_name || '-'}
                      {user.username && <span style={{ fontSize: '0.72rem', marginLeft: 4, opacity: 0.6 }}>@{user.username}</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}><TierBadge tier={user.membership_tier || 'free'} /></td>
                    <td style={{ padding: '8px 10px' }}>
                      <ExpiryCell tier={user.membership_tier} expiresAt={user.membership_expires_at} />
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: user.membership_first_used_at ? '#e57373' : 'var(--color-text-light)' }}>
                      {user.membership_first_used_at ? fmtKST(user.membership_first_used_at) : '-'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
                      {fmtKST(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handlePage(page - 1)} disabled={page === 1 || loading}>
              <Mi style={{ fontSize: 16 }}>chevron_left</Mi>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce((acc, n, i, arr) => {
                if (i > 0 && n - arr[i - 1] > 1) acc.push('…')
                acc.push(n); return acc
              }, [])
              .map((n, i) => n === '…'
                ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--color-text-light)' }}>…</span>
                : <button key={n}
                    className={`btn btn-sm ${page === n ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handlePage(n)} disabled={loading}
                    style={{ minWidth: 32, padding: '3px 6px', fontSize: '0.78rem', justifyContent: 'center' }}>
                    {n}
                  </button>
              )}
            <button className="btn btn-ghost btn-sm" onClick={() => handlePage(page + 1)} disabled={page === totalPages || loading}>
              <Mi style={{ fontSize: 16 }}>chevron_right</Mi>
            </button>
            <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
              {page} / {totalPages}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
