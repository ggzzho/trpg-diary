// src/pages/AdminMembershipPage.js
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { membershipApi } from '../lib/supabase'
import { Mi } from '../components/Mi'

// ── 등급 메타 ─────────────────────────────────────────────────
const TIER_META = {
  master: { label: '마스터',    color: '#9c27b0', bg: 'rgba(156,39,176,0.10)', icon: 'shield_person' },
  free:   { label: '일반',      color: '#7a6050', bg: 'rgba(122,96,80,0.10)',  icon: 'person' },
  lv1:    { label: '후원 Lv.1', color: '#43a047', bg: 'rgba(67,160,71,0.10)', icon: 'favorite' },
  lv2:    { label: '후원 Lv.2', color: '#1976d2', bg: 'rgba(25,118,210,0.10)',icon: 'stars' },
  lv3:    { label: '후원 Lv.3', color: '#c8a96e', bg: 'rgba(200,169,110,0.12)',icon: 'workspace_premium' },
}
const ASSIGNABLE_TIERS = ['free', 'lv1', 'lv2', 'lv3'] // master는 DB 직접 설정만 가능

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
  const [tab, setTab] = useState('search') // 'search' | 'list'

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
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['search','search','유저 검색·등급 변경'], ['list','group','전체 회원 목록']].map(([v, icon, label]) => (
          <button key={v}
            className={`btn btn-sm ${tab === v ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(v)}>
            <Mi size="sm">{icon}</Mi>{label}
          </button>
        ))}
      </div>

      {tab === 'search' ? <SearchTab /> : <ListTab />}
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
            placeholder="이메일 일부 또는 전체 입력 (최대 10명 표시)"
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
// Tab 2: 전체 회원 목록
// ══════════════════════════════════════════════════════════════
const TIER_FILTER_OPTIONS = [
  { value: null,     label: '전체' },
  { value: 'master', label: '마스터' },
  { value: 'lv3',    label: '후원 Lv.3' },
  { value: 'lv2',    label: '후원 Lv.2' },
  { value: 'lv1',    label: '후원 Lv.1' },
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
      ['master','lv3','lv2','lv1','free'].map(t =>
        membershipApi.listUsers({ tier: t, page: 1, perPage: 1 })
      )
    )
    const keys = ['master','lv3','lv2','lv1','free']
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
          {['master','lv3','lv2','lv1','free'].map(t => {
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
