// src/pages/AdminDataStatsPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'

// ── 상수 ──────────────────────────────────────────────────
const TIER_LABEL = {
  free:   '일반',
  lv1:    '♥ 원하트',
  lv2:    '♥♥ 투하트',
  lv3:    '♥♥♥ 풀하트',
  master: '마스터',
}
const TIER_COLOR = {
  free:   '#aaaaaa',
  lv1:    '#e57373',
  lv2:    '#e57373',
  lv3:    '#e57373',
  master: '#c8a96e',
}
const TIER_ORDER = ['free', 'lv1', 'lv2', 'lv3', 'master']

const BOARDS = [
  { key: 'schedules_count',      label: '일정' },
  { key: 'rulebooks_count',      label: '보유 룰북' },
  { key: 'scenarios_count',      label: '보유 시나리오' },
  { key: 'wish_scenarios_count', label: '위시 시나리오' },
  { key: 'dotori_count',         label: '도토리' },
  { key: 'availability_count',   label: '공수표 목록' },
  { key: 'play_logs_count',      label: '다녀온 기록' },
  { key: 'pairs_count',          label: '페어/팀 목록' },
  { key: 'characters_count',     label: 'PC 목록' },
  { key: 'bookmarks_count',      label: '북마크' },
]

const RANGES = [
  { label: '1,000개 미만',    min: 0,    max: 999 },
  { label: '1,000~2,000개',  min: 1000, max: 1999 },
  { label: '2,000~3,000개',  min: 2000, max: 2999 },
  { label: '3,000~5,000개',  min: 3000, max: 4999 },
  { label: '5,000개 초과',   min: 5000, max: Infinity },
]

// ── 미니 바 ──
function MiniBar({ value, max, color = 'var(--color-primary)', height = 10 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ background: 'var(--color-border)', borderRadius: 99, height, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  )
}

// ── 요약 카드 ──
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--color-nav-active-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Mi color="accent">{icon}</Mi>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--color-accent)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── 다운로드 헬퍼 ──
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename
  a.click(); URL.revokeObjectURL(url)
}

// ── CSV 내보내기 ──
function downloadCsv(rows) {
  const headers = ['순위','닉네임','username','등급','총계','일정','보유룰북','보유시나리오','위시시나리오','도토리','공수표','다녀온기록','페어팀','PC목록','북마크','가입일']
  const lines = rows.map((r, i) => [
    i + 1, r.display_name || '', r.username || '',
    TIER_LABEL[r.membership_tier] || r.membership_tier || '',
    r.total_count,
    r.schedules_count, r.rulebooks_count, r.scenarios_count,
    r.wish_scenarios_count, r.dotori_count, r.availability_count,
    r.play_logs_count, r.pairs_count, r.characters_count,
    r.bookmarks_count,
    r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '',
  ].join(','))
  const csv = '﻿' + [headers.join(','), ...lines].join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `trpg_data_stats_${new Date().toISOString().slice(0,10)}.csv`)
}

// ── JSON 내보내기 ──
function downloadJson(rows, summary, distribution, tierStats) {
  const payload = {
    exported_at: new Date().toISOString(),
    summary: {
      user_count:     summary?.userCount    ?? 0,
      total_records:  summary?.totalRecords ?? 0,
      avg_per_user:   summary?.avg          ?? 0,
      max_per_user:   summary?.max          ?? 0,
    },
    distribution: distribution.map(d => ({
      range: d.label, user_count: d.count, pct: Number(d.pct),
    })),
    tier_stats: tierStats.map(t => ({
      tier: t.tier, label: TIER_LABEL[t.tier], user_count: t.count, avg: t.avg,
    })),
    users: rows.map((r, i) => ({
      rank:             i + 1,
      display_name:     r.display_name || '',
      username:         r.username     || '',
      membership_tier:  TIER_LABEL[r.membership_tier] || r.membership_tier || '',
      created_at:       r.created_at   || '',
      total_count:      Number(r.total_count),
      boards: {
        schedules:      Number(r.schedules_count),
        rulebooks:      Number(r.rulebooks_count),
        scenarios:      Number(r.scenarios_count),
        wish_scenarios: Number(r.wish_scenarios_count),
        dotori:         Number(r.dotori_count),
        availability:   Number(r.availability_count),
        play_logs:      Number(r.play_logs_count),
        pairs:          Number(r.pairs_count),
        characters:     Number(r.characters_count),
        bookmarks:      Number(r.bookmarks_count),
      },
    })),
  }
  const json = JSON.stringify(payload, null, 2)
  triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8;' }), `trpg_data_stats_${new Date().toISOString().slice(0,10)}.json`)
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function AdminDataStatsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [tierFilter, setTierFilter] = useState('all')
  const [sortKey,    setSortKey]    = useState('total_count')
  const [sortDir,    setSortDir]    = useState('desc')

  // 접근 제어
  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/dashboard')
  }, [profile])

  // 데이터 로드
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('admin_get_user_data_stats')
      if (!error) setRows(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── 집계 ──
  const summary = useMemo(() => {
    if (!rows.length) return null
    const totals = rows.map(r => Number(r.total_count))
    const sum    = totals.reduce((a, b) => a + b, 0)
    return {
      userCount: rows.length,
      totalRecords: sum,
      avg: Math.round(sum / rows.length),
      max: Math.max(...totals),
    }
  }, [rows])

  // 구간별 분포
  const distribution = useMemo(() => RANGES.map(range => {
    const count = rows.filter(r => {
      const t = Number(r.total_count)
      return t >= range.min && t <= range.max
    }).length
    return { ...range, count, pct: rows.length ? ((count / rows.length) * 100).toFixed(1) : 0 }
  }), [rows])

  // 등급별 평균
  const tierStats = useMemo(() => TIER_ORDER.map(tier => {
    const group = rows.filter(r => r.membership_tier === tier)
    const avg   = group.length ? Math.round(group.reduce((a, r) => a + Number(r.total_count), 0) / group.length) : 0
    return { tier, count: group.length, avg }
  }), [rows])
  const maxTierAvg = Math.max(...tierStats.map(t => t.avg), 1)

  // 게시판별 합계
  const boardTotals = useMemo(() => {
    return BOARDS.map(b => ({
      ...b,
      total: rows.reduce((a, r) => a + Number(r[b.key] || 0), 0),
    }))
  }, [rows])
  const maxBoard = Math.max(...boardTotals.map(b => b.total), 1)

  // 필터 + 정렬
  const filtered = useMemo(() => {
    let list = tierFilter === 'all' ? rows : rows.filter(r => r.membership_tier === tierFilter)
    return [...list].sort((a, b) => {
      const va = Number(a[sortKey] ?? 0)
      const vb = Number(b[sortKey] ?? 0)
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [rows, tierFilter, sortKey, sortDir])

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filtered, 20)
  const maxTotal = filtered.length ? Number(filtered[0]?.total_count ?? 1) : 1

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }
  const SortIcon = ({ k }) => sortKey === k
    ? <Mi size="sm">{sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}</Mi>
    : null

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-light)', fontSize: '0.88rem' }}>통계 불러오는 중...</div>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0 60px' }}>

      {/* 헤더 */}
      <div className="page-header flex justify-between items-center" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">
            <Mi style={{ marginRight: 8, verticalAlign: 'middle' }}>bar_chart</Mi>
            데이터 사용량 통계
          </h1>
          <p className="page-subtitle">전체 회원의 게시판 등록 현황 · 관리자 전용</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => downloadCsv(filtered)}>
            <Mi size="sm">download</Mi> CSV
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => downloadJson(filtered, summary, distribution, tierStats)}>
            <Mi size="sm">data_object</Mi> JSON
          </button>
        </div>
      </div>

      {/* ① 요약 카드 */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          <StatCard icon="group"        label="전체 회원 수"      value={summary.userCount.toLocaleString() + '명'} />
          <StatCard icon="storage"      label="전체 레코드 합계"  value={summary.totalRecords.toLocaleString() + '개'} />
          <StatCard icon="avg_pace"     label="유저 평균 사용량"  value={summary.avg.toLocaleString() + '개'} />
          <StatCard icon="trending_up"  label="최대 사용량"       value={summary.max.toLocaleString() + '개'} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* ② 구간별 분포 */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, color: 'var(--color-accent)' }}>
            구간별 유저 분포
          </h3>
          {distribution.map(d => (
            <div key={d.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text)' }}>{d.label}</span>
                <span style={{ color: 'var(--color-text-light)' }}>
                  {d.count.toLocaleString()}명 ({d.pct}%)
                </span>
              </div>
              <MiniBar value={d.count} max={Math.max(...distribution.map(x => x.count), 1)} height={12} />
            </div>
          ))}
        </div>

        {/* ③ 등급별 평균 사용량 */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, color: 'var(--color-accent)' }}>
            등급별 평균 사용량
          </h3>
          {tierStats.map(t => (
            <div key={t.tier} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                  {TIER_LABEL[t.tier]}
                  <span style={{ fontWeight: 400, color: 'var(--color-text-light)', marginLeft: 6 }}>({t.count}명)</span>
                </span>
                <span style={{ color: 'var(--color-text-light)' }}>{t.avg.toLocaleString()}개 평균</span>
              </div>
              <MiniBar value={t.avg} max={maxTierAvg} color={TIER_COLOR[t.tier]} height={12} />
            </div>
          ))}
        </div>
      </div>

      {/* ④ 게시판별 총 레코드 */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, color: 'var(--color-accent)' }}>
          게시판별 전체 레코드 수
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {boardTotals.map(b => (
            <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', minWidth: 110, flexShrink: 0 }}>{b.label}</span>
              <div style={{ flex: 1 }}>
                <MiniBar value={b.total} max={maxBoard} height={14} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', minWidth: 72, textAlign: 'right' }}>
                {b.total.toLocaleString()}개
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ⑤ 상위 유저 테이블 */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-accent)', margin: 0 }}>
            사용량 상위 유저 ({filtered.length.toLocaleString()}명)
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...TIER_ORDER].map(t => (
              <button key={t}
                className={`btn btn-sm ${tierFilter === t ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setTierFilter(t); setPage(1) }}
                style={{ fontSize: '0.72rem' }}>
                {t === 'all' ? '전체' : TIER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-light)' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>닉네임</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>등급</th>
                {[
                  { k: 'total_count',            l: '총계' },
                  { k: 'schedules_count',        l: '일정' },
                  { k: 'rulebooks_count',        l: '룰북' },
                  { k: 'scenarios_count',        l: '보유시날' },
                  { k: 'wish_scenarios_count',   l: '위시시날' },
                  { k: 'dotori_count',           l: '도토리' },
                  { k: 'availability_count',     l: '공수표' },
                  { k: 'play_logs_count',        l: '기록' },
                  { k: 'pairs_count',            l: '페어/팀' },
                  { k: 'characters_count',       l: 'PC' },
                  { k: 'bookmarks_count',        l: '북마크' },
                ].map(col => (
                  <th key={col.k}
                    onClick={() => handleSort(col.k)}
                    style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap',
                      cursor: 'pointer', userSelect: 'none',
                      color: sortKey === col.k ? 'var(--color-primary)' : 'var(--color-text-light)',
                    }}>
                    {col.l} <SortIcon k={col.k} />
                  </th>
                ))}
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>가입일</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const rank = (page - 1) * perPage + i + 1
                const isTop3 = rank <= 3
                return (
                  <tr key={r.user_id}
                    style={{ borderBottom: '1px solid var(--color-border)',
                      background: isTop3 ? 'var(--color-nav-active-bg)' : 'transparent' }}>
                    <td style={{ padding: '8px 6px', color: isTop3 ? 'var(--color-primary)' : 'var(--color-text-light)', fontWeight: isTop3 ? 700 : 400 }}>
                      {rank}
                    </td>
                    <td style={{ padding: '8px 6px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{r.display_name || '(이름없음)'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-light)' }}>@{r.username}</div>
                    </td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 600,
                        background: 'var(--color-nav-active-bg)', color: TIER_COLOR[r.membership_tier] || 'var(--color-text-light)',
                        border: `1px solid ${TIER_COLOR[r.membership_tier] || 'var(--color-border)'}`,
                      }}>
                        {TIER_LABEL[r.membership_tier] || r.membership_tier || '일반'}
                      </span>
                    </td>
                    {/* 총계 + 인라인 바 */}
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{Number(r.total_count).toLocaleString()}</div>
                      <MiniBar value={Number(r.total_count)} max={maxTotal} height={5} />
                    </td>
                    {[
                      'schedules_count','rulebooks_count','scenarios_count',
                      'wish_scenarios_count','dotori_count','availability_count',
                      'play_logs_count','pairs_count','characters_count',
                      'bookmarks_count',
                    ].map(k => (
                      <td key={k} style={{ padding: '8px 6px', textAlign: 'right', color: Number(r[k]) > 0 ? 'var(--color-text)' : 'var(--color-text-light)' }}>
                        {Number(r[k]).toLocaleString()}
                      </td>
                    ))}
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage} />
      </div>
    </div>
  )
}
