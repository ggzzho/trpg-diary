// src/pages/Dashboard.js
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { schedulesApi, playLogsApi, rulebooksApi, scenariosApi, pairsApi } from '../lib/supabase'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ schedules: 0, logs: 0, rulebooks: 0, scenarios: 0, pairs: 0 })
  const [upcoming, setUpcoming] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [s, l, r, sc, p] = await Promise.all([
        schedulesApi.getAll(user.id),
        playLogsApi.getAll(user.id),
        rulebooksApi.getAll(user.id),
        scenariosApi.getAll(user.id),
        pairsApi.getAll(user.id),
      ])
      setStats({
        schedules: s.data?.length || 0,
        logs: l.data?.length || 0,
        rulebooks: r.data?.length || 0,
        scenarios: sc.data?.length || 0,
        pairs: p.data?.length || 0,
      })
      const today = new Date().toISOString().split('T')[0]
      setUpcoming(
        (s.data || [])
          .filter(x => x.scheduled_date >= today && x.status !== 'cancelled')
          .sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date))
          .slice(0, 3)
      )
      setRecentLogs((l.data || []).slice(0, 4))
      setLoading(false)
    }
    load()
  }, [user])

  const greet = () => {
    const h = new Date().getHours()
    if (h < 6) return '밤이 깊었네요 🌙'
    if (h < 12) return '좋은 아침이에요 ☀️'
    if (h < 18) return '즐거운 오후예요 ✨'
    return '편안한 저녁이에요 🕯️'
  }

  const STAT_CARDS = [
    { label: '다녀온 기록', value: stats.logs, icon: '📖', to: '/logs', unit: '회' },
    { label: '보유 룰북', value: stats.rulebooks, icon: '📚', to: '/rulebooks', unit: '권' },
    { label: '보유 시나리오', value: stats.scenarios, icon: '🗺️', to: '/scenarios', unit: '개' },
    { label: '페어 목록', value: stats.pairs, icon: '👥', to: '/pairs', unit: '명' },
  ]

  return (
    <div className="fade-in">
      {/* 인사 헤더 */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: 6 }}>
          {greet()}
        </p>
        <h1 className="text-serif" style={{ fontSize: '2rem', color: 'var(--color-accent)' }}>
          {profile?.display_name || profile?.username}님의 다이어리
        </h1>
        <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', marginTop: 8 }}>
          오늘도 좋은 세션 되세요 🎲
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid-auto" style={{ marginBottom: 36 }}>
        {STAT_CARDS.map(c => (
          <Link key={c.label} to={c.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: '2rem' }}>{c.icon}</span>
              <div>
                <div className="text-serif" style={{ fontSize: '1.8rem', color: 'var(--color-accent)', fontWeight: 700 }}>
                  {loading ? '—' : c.value}<span style={{ fontSize: '0.9rem', marginLeft: 4 }}>{c.unit}</span>
                </div>
                <div className="text-sm text-light">{c.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        {/* 다가오는 일정 */}
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
            <h2 className="text-serif" style={{ color: 'var(--color-accent)', fontSize: '1.1rem' }}>
              📅 다가오는 일정
            </h2>
            <Link to="/schedule" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {upcoming.length === 0
            ? <p className="text-light text-sm">예정된 일정이 없어요</p>
            : upcoming.map(s => (
              <div key={s.id} style={{
                padding: '12px 0',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <div style={{
                  background: 'rgba(200,169,110,0.15)', borderRadius: 8,
                  padding: '6px 10px', textAlign: 'center', minWidth: 44, flexShrink: 0
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
                    {format(new Date(s.scheduled_date), 'M월', { locale: ko })}
                  </div>
                  <div className="text-serif" style={{ fontSize: '1.2rem', color: 'var(--color-accent)', fontWeight: 700 }}>
                    {format(new Date(s.scheduled_date), 'd')}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{s.title}</div>
                  <div className="text-xs text-light">{s.system_name} {s.is_gm ? '· GM' : '· PL'}</div>
                </div>
              </div>
            ))
          }
        </div>

        {/* 최근 플레이 기록 */}
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
            <h2 className="text-serif" style={{ color: 'var(--color-accent)', fontSize: '1.1rem' }}>
              📖 최근 기록
            </h2>
            <Link to="/logs" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {recentLogs.length === 0
            ? <p className="text-light text-sm">아직 기록이 없어요</p>
            : recentLogs.map(l => (
              <div key={l.id} style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{l.title}</div>
                  <div className="text-xs text-light">
                    {format(new Date(l.played_date), 'yyyy.MM.dd')} · {l.role}
                  </div>
                </div>
                {l.rating && (
                  <div className="stars" style={{ fontSize: '0.8rem' }}>
                    {'★'.repeat(l.rating)}{'☆'.repeat(5 - l.rating)}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* 공유 링크 */}
      {profile && (
        <div className="card" style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="text-serif" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>
              🔗 내 공개 페이지
            </div>
            <div className="text-sm text-light">
              {window.location.origin}/u/{profile.username}
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`)
              alert('링크가 복사되었어요!')
            }}
          >
            링크 복사
          </button>
        </div>
      )}
    </div>
  )
}
