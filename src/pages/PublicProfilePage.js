// src/pages/PublicProfilePage.js
import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getProfile, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { GuestbookPublicView, FeedbackPublicView } from './GuestbookPage'
import { LogDetailContent } from './PlayLogPage'
import { FOOTER_TEXT, Modal, Pagination } from '../components/Layout'
import { Mi } from '../components/Mi'
import { usePagination } from '../hooks/usePagination'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday, addMonths, subMonths
} from 'date-fns'
import { ko } from 'date-fns/locale'

const SCENARIO_STATUS = { unplayed:'미플', played:'PL완료', gm_done:'GM완료', want:'위시' }

function calcDday(d) {
  if (!d) return null
  return Math.floor((new Date() - new Date(d)) / 86400000)
}

// ── 공개 페이지 태그칩: 불투명 ──
const TC = {
  series: { bg:'#c8a96e', color:'#fff', border:'#b8944e' },
  role_PL: { bg:'#4a7ad4', color:'#fff', border:'#3a6ac4' },
  role_GM: { bg:'#7a5ab8', color:'#fff', border:'#6a4aa8' },
  rule: { bg:'#5a8a40', color:'#fff', border:'#4a7a30' },
}
function Chip({ type, label }) {
  const c = type==='series' ? TC.series : type==='role' ? (label==='GM' ? TC.role_GM : TC.role_PL) : TC.rule
  return (
    <span style={{ display:'inline-flex', padding:'2px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:700,
      background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

// ── 미니 캘린더 ──
function PublicCalendar({ schedules, blocked = [] }) {
  const [cal, setCal] = useState(new Date())
  const startDate = startOfWeek(startOfMonth(cal), { weekStartsOn:0 })
  const endDate = endOfWeek(endOfMonth(cal), { weekStartsOn:0 })
  const rows = []
  let day = startDate
  while (day <= endDate) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(day)
      const dStr = format(d, 'yyyy-MM-dd')
      const dayScheds = schedules.filter(s => s.scheduled_date === dStr)
      const dayBlocked = blocked.filter(b => b.scheduled_date === dStr)
      const hasBlocked = dayBlocked.length > 0
      week.push(
        <div key={dStr}
          className={`calendar-cell ${isToday(d)?'today':''} ${!isSameMonth(d,cal)?'other-month':''}`}
          style={{ cursor:'default', outline: hasBlocked ? '2px solid #e57373' : 'none', outlineOffset:'-2px' }}
        >
          <div className="calendar-date">{format(d,'d')}</div>
          {dayScheds.slice(0,2).map((s,idx) => (
            <div key={idx} className={`calendar-event${s.is_gm?' gm':''}`} title={s.title}>
              {s.scheduled_time && <span style={{ opacity:0.85, marginRight:2 }}>{s.scheduled_time.slice(0,5)}</span>}
              {s.title}
            </div>
          ))}
          {dayScheds.length > 2 && (
            <div style={{ fontSize:'0.55rem', color:'var(--color-text-light)', paddingLeft:2 }}>+{dayScheds.length-2}개 더</div>
          )}
          {dayBlocked.map((b,idx) => (
            <div key={`bl${idx}`}
              style={{ fontSize:'0.58rem', padding:'1px 3px', borderRadius:3, marginBottom:2,
                background:'rgba(229,115,115,0.15)', color:'#e57373',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
              title={[
                b.blocked_from && b.blocked_until ? `${b.blocked_from.slice(0,5)}~${b.blocked_until.slice(0,5)}`
                  : b.blocked_from ? `${b.blocked_from.slice(0,5)}~` : '',
                b.description
              ].filter(Boolean).join(' ')}
            >
              🚫 {b.blocked_from ? `${b.blocked_from.slice(0,5)}${b.blocked_until?`~${b.blocked_until.slice(0,5)}`:'~'}` : '종일'}
            </div>
          ))}
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(<React.Fragment key={day.toString()}>{week}</React.Fragment>)
  }
  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom:14 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCal(subMonths(cal,1))}>‹ 이전</button>
        <span style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-accent)' }}>{format(cal,'yyyy년 M월',{locale:ko})}</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCal(addMonths(cal,1))}>다음 ›</button>
      </div>
      <div className="calendar-grid" style={{ marginBottom:3 }}>
        {['일','월','화','수','목','금','토'].map((d,i) => (
          <div key={d} className="calendar-day-header"
            style={{ color: i===0?'#e57373':i===6?'#6b8cba':'var(--color-text-light)' }}>{d}</div>
        ))}
      </div>
      <div className="calendar-grid">{rows}</div>
    </div>
  )
}

// ── 메인 컴포넌트 ──
export default function PublicProfilePage() {
  const { username } = useParams()
  const [searchParams] = useSearchParams()
  const { user, profile: myProfile, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'schedules')
  const [selectedLog, setSelectedLog] = useState(null)
  const [pairSort, setPairSort] = useState('asc')
  const [rulebookExpanded, setRulebookExpanded] = useState({})
  const [scenarioExpanded, setScenarioExpanded] = useState({})
  const [kakaoPopup, setKakaoPopup] = useState(false)

  // 페이지네이션 - Hook이므로 early return 전에 선언 필수
  const logsPagination = usePagination(data.logs||[], 20)
  const scenarioParents = (data.scenarios||[]).filter(s => !s.parent_id)
  const scenarioChildMap = (data.scenarios||[]).filter(s => !!s.parent_id).reduce((m,s) => {
    if (!m[s.parent_id]) m[s.parent_id] = []
    m[s.parent_id].push(s)
    return m
  }, {})
  const scenariosPagination = usePagination(scenarioParents, 20)
  const availabilityPagination = usePagination(data.availability||[], 20)
  const pairsPagination = usePagination(data.pairs||[], 20)

  useEffect(() => {
    const load = async () => {
      const { data:p, error } = await getProfile(username)
      if (error || !p) { setNotFound(true); setLoading(false); return }
      setProfile(p)
      // 탭 제목: ✦ TRPG Diary - 닉네임 또는 @아이디
      const displayName = p.display_name || p.username
      document.title = `✦ TRPG Diary - ${displayName}`

      // OG 메타태그 동적 업데이트
      const ogImage = p.header_image_url || p.avatar_url || 'https://trpg-diary.co.kr/logo512.png'
      const ogTitle = `${displayName}의 TRPG Diary`
      const ogDesc = p.play_style || `${displayName}님의 TRPG 다이어리 - trpg-diary.co.kr`
      const ogUrl = `https://trpg-diary.co.kr/u/${p.username}`
      const setMeta = (prop, val, attr='property') => {
        let el = document.querySelector(`meta[${attr}="${prop}"]`)
        if (!el) { el = document.createElement('meta'); el.setAttribute(attr, prop); document.head.appendChild(el) }
        el.setAttribute('content', val)
      }
      setMeta('og:title', ogTitle); setMeta('og:description', ogDesc)
      setMeta('og:image', ogImage); setMeta('og:url', ogUrl)
      setMeta('twitter:title', ogTitle, 'name'); setMeta('twitter:description', ogDesc, 'name')
      setMeta('twitter:image', ogImage, 'name')

      // 페어 정렬 설정 동기화
      if (p.pair_sort_order) setPairSort(p.pair_sort_order)
      applyTheme(p.theme_color||'#c8a96e', p.theme_bg_color||'#faf6f0', p.theme_accent||'#8b6f47')
      applyBackground(p.background_image_url||'', p.bg_opacity !== undefined ? p.bg_opacity : 1)

      const today = new Date().toISOString().split('T')[0]
      const safe = async fn => { try { const r = await fn; return r.data || [] } catch { return [] } }
      const [logs, rulebooks, scenarios, pairs, avail, schedsAll] = await Promise.all([
        safe(playLogsApi.getAll(p.id)),
        safe(supabase.from('rulebooks').select('*').eq('user_id', p.id).order('title').then(r=>r)),
        safe(scenariosApi.getAll(p.id)),
        safe(pairsApi.getAll(p.id)),
        safe(supabase.from('availability').select('*').eq('user_id',p.id).eq('is_active',true).then(r=>r)),
        safe(supabase.from('schedules').select('*').eq('user_id',p.id)
          .order('scheduled_date').then(r=>r)),
      ])
      const scheds = schedsAll.filter(s => s.entry_type !== 'blocked' && s.status !== 'cancelled' && s.status !== 'completed' && s.scheduled_date >= today)
      const blocked = schedsAll.filter(s => s.entry_type === 'blocked')
      setData({ logs, rulebooks, scenarios, pairs, availability:avail, schedules:scheds, blocked })

      // hidden_tabs가 있으면 초기 탭이 숨겨져 있을 수 있으므로 첫 번째 보이는 탭으로 조정
      const hidden = p.hidden_tabs || []
      const allTabKeys = ['schedules','rulebooks','logs','availability','scenarios','pairs','guestbook']
      const requestedTab = searchParams.get('tab') || 'schedules'
      if (hidden.includes(requestedTab)) {
        const firstVisible = allTabKeys.find(k => !hidden.includes(k)) || 'guestbook'
        setActiveTab(firstVisible)
      }

      setLoading(false)
    }
    load()
  }, [username])

  // 페이지 떠날 때 탭 제목 복원
  useEffect(() => {
    return () => { document.title = 'TRPG Diary ✦' }
  }, [])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--color-text-light)', fontSize:'0.88rem' }}>불러오는 중...</div>
    </div>
  )
  if (notFound) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center' }}>
        <Mi size='lg' style={{fontSize:40,marginBottom:14}}>description</Mi>
        <h1 style={{ fontWeight:700, color:'var(--color-accent)', marginBottom:7, fontSize:'1.3rem' }}>페이지를 찾을 수 없어요</h1>
        <p style={{ color:'var(--color-text-light)', fontSize:'0.85rem' }}>@{username} 사용자가 없거나 비공개예요</p>
      </div>
    </div>
  )

  const sections = (() => {
    if (profile.profile_sections?.length > 0) return profile.profile_sections
    const l = []
    if (profile.play_style) l.push({ label:'플레이 스타일', value:profile.play_style })
    if (profile.caution) l.push({ label:'주의 사항', value:profile.caution })
    if (profile.extra_info) l.push({ label:'기타 사항', value:profile.extra_info })
    return l
  })()

  const hiddenTabs = profile?.hidden_tabs || []
  const TABS = [
    { key:'schedules', label:'일정', icon:'calendar_month', count:data.schedules?.length },
    { key:'rulebooks', label:'룰북', icon:'menu_book', count:(data.rulebooks||[]).filter(r=>!r.parent_id).length },
    { key:'logs', label:'기록', icon:'auto_stories', count:data.logs?.length },
    { key:'availability', label:'공수표', icon:'event_available', count:data.availability?.length },
    { key:'scenarios', label:'시나리오', icon:'description', count:scenarioParents.length },
    { key:'pairs', label:'페어', icon:'people', count:data.pairs?.length },
    { key:'guestbook', label:'방명록', icon:'mail' },
    ...(profile?.is_admin ? [{ key:'feedback', label:'문의/피드백', icon:'support_agent' }] : []),
  ].filter(t => !hiddenTabs.includes(t.key))

  const sortedPairs = [...(data.pairs||[])].sort((a,b) => {
    const da = a.first_met_date||'', db = b.first_met_date||''
    return pairSort === 'asc' ? da.localeCompare(db) : db.localeCompare(da)
  })

  // 각 탭 페이지네이션 - pagedPairs 계산
  const pagedPairs = sortedPairs.slice((pairsPagination.page-1)*pairsPagination.perPage, pairsPagination.page*pairsPagination.perPage)

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 20px 0' }}>

      {/* 로그인 상태 표시 배지 - auth 로딩 완료 후 표시 */}
      {!authLoading && (
      <div
        onClick={() => { if (user) window.location.href='/dashboard'; else window.location.href='/login' }}
        style={{
          position:'fixed', bottom:20, right:20, zIndex:9999,
          display:'flex', alignItems:'center', gap:8,
          padding:'7px 12px', borderRadius:100,
          background: user ? 'var(--color-primary)' : 'rgba(0,0,0,0.55)',
          color:'white', fontSize:'0.75rem', fontWeight:600,
          boxShadow:'0 2px 12px rgba(0,0,0,0.2)',
          backdropFilter:'blur(8px)',
          cursor:'pointer',
          transition:'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity='1'}
        title={user ? '대시보드로 이동' : '로그인 / 회원가입'}
      >
        {user ? (
          <>
            <div style={{ width:18, height:18, borderRadius:'50%', overflow:'hidden', background:'rgba(255,255,255,0.3)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700 }}>
              {myProfile?.avatar_url
                ? <img src={myProfile.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : (myProfile?.display_name||user.email||'?')[0]
              }
            </div>
            <span>{myProfile?.display_name || myProfile?.username || '로그인 중'}</span>
          </>
        ) : (
          <>
            <span style={{ opacity:0.8 }}>👤</span>
            <span>로그인 / 회원가입</span>
          </>
        )}
      </div>
      )}

      {/* 프로필 카드 */}
      <div className="card" style={{ marginBottom:24, overflow:'visible', padding:0 }}>
        {/* 헤더 이미지 */}
        <div style={{ height:235, background:'var(--color-nav-active-bg)', borderRadius:'var(--radius) var(--radius) 0 0', overflow:'hidden' }}>
          {profile.header_image_url
            ? <img src={profile.header_image_url} alt="header"
                style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>
            : <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,var(--color-primary),var(--color-accent))`, opacity:0.3 }}/>
          }
        </div>

        <div style={{ padding:'0 24px 24px', textAlign:'center' }}>
          {/* 아바타 */}
          <div style={{ display:'flex', justifyContent:'center', marginTop:-60, marginBottom:12 }}>
            <div className="user-avatar" style={{
              width:120, height:120, fontSize:'2.8rem',
              border:'4px solid white', boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
              background:'var(--color-primary)', color:'white',
              position:'relative', zIndex:2
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar"/>
                : (profile.display_name||'?')[0]
              }
            </div>
          </div>

          <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--color-accent)', letterSpacing:'-0.03em', marginBottom:2 }}>
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-light">@{profile.username}</p>

          {/* 통계 */}
          <div className="flex justify-between" style={{ marginTop:16, padding:'12px 0', borderTop:'1px solid var(--color-border)', borderBottom:'1px solid var(--color-border)' }}>
            {[
              { label:'기록', v:data.logs?.length||0 },
              { label:'룰북', v:(data.rulebooks||[]).filter(r=>!r.parent_id).length },
              { label:'시나리오', v:data.scenarios?.length||0 },
              { label:'페어', v:data.pairs?.length||0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', flex:1 }}>
                <div style={{ fontSize:'1.3rem', color:'var(--color-accent)', fontWeight:700 }}>{s.v}</div>
                <div className="text-xs text-light">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 프로필 소개 */}
          {sections.filter(s=>s.value).length > 0 && (
            <div style={{ marginTop:16, textAlign:'left', display:'flex', flexDirection:'column', gap:12 }}>
              {sections.filter(s=>s.value).map((sec,i) => (
                <div key={i}>
                  <div style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--color-accent)', marginBottom:4 }}>{sec.label}</div>
                  <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{sec.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 외부 링크 */}
          {profile.external_links?.length > 0 && (
            <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
              {profile.external_links.map((link,i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer"
                  style={{ padding:'4px 12px', borderRadius:100, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', fontSize:'0.76rem', fontWeight:600, textDecoration:'none' }}>
                  <Mi size="sm">link</Mi> {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-8" style={{ marginBottom:20, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key}
            className={`btn btn-sm ${activeTab===t.key?'btn-primary':'btn-outline'}`}
            onClick={() => setActiveTab(t.key)}
            style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Mi size="sm" color={activeTab===t.key?'white':'accent'}>{t.icon}</Mi>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── 일정 (캘린더) ── */}
      {activeTab==='schedules' && <PublicCalendar schedules={data.schedules||[]} blocked={data.blocked||[]}/>}

      {/* ── 기록 (카드 + 팝업) ── */}
      {activeTab==='logs' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(238px,1fr))', gap:13 }}>
            {!data.logs?.length
              ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem', gridColumn:'1/-1' }}>아직 기록이 없어요</div>
              : logsPagination.paged.map(l => (
                <div key={l.id}
                  style={{ borderRadius:12, overflow:'hidden', background:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'0 2px 12px var(--color-shadow)', display:'flex', flexDirection:'column', cursor:'pointer', transition:'transform 0.15s,box-shadow 0.15s' }}
                  onClick={() => setSelectedLog(l)}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
                >
                  <div style={{ position:'relative', paddingTop:'56.25%' }}>
                    <div style={{ position:'absolute', inset:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      {l.session_image_url
                        ? <img src={l.session_image_url} alt={l.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <span style={{ fontSize:'2.5rem', opacity:0.2 }}><Mi size='lg' color='light'>auto_stories</Mi></span>
                      }
                    </div>
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'65%', background:'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.3) 55%,transparent 100%)', pointerEvents:'none' }}/>
                    <div style={{ position:'absolute', bottom:8, left:8, right:8, display:'flex', gap:4, flexWrap:'wrap' }}>
                      {l.series_tag && <Chip type="series" label={l.series_tag}/>}
                      <Chip type="role" label={l.role}/>
                      {l.system_name && <Chip type="rule" label={l.system_name}/>}
                    </div>
                  </div>
                  <div style={{ padding:'10px 12px 12px', flex:1, display:'flex', flexDirection:'column' }}>
                    <div style={{ fontWeight:700, fontSize:'1rem', lineHeight:1.3, marginBottom:8 }}>{l.title}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {(l.together_with||l.character_name) && (
                        <div style={{ fontSize:'0.79rem', color:'var(--color-text-light)', display:'flex', gap:12, flexWrap:'wrap' }}>
                          {l.together_with && <span><span style={{ fontWeight:600, marginRight:4 }}>GM.</span>{l.together_with}</span>}
                          {l.character_name && <span><span style={{ fontWeight:600, marginRight:4 }}>PL.</span>{l.character_name}</span>}
                        </div>
                      )}
                      {l.npc && <div style={{ fontSize:'0.79rem', color:'var(--color-text-light)' }}><span style={{ fontWeight:600, marginRight:4 }}>등장인물.</span>{l.npc}</div>}
                      {(l.start_date||l.played_date) && (
                        <div style={{ fontSize:'0.79rem', color:'var(--color-text-light)', display:'flex', gap:14, flexWrap:'wrap' }}>
                          {l.start_date && <span><span style={{ fontWeight:600, marginRight:4 }}>Start.</span>{format(new Date(l.start_date),'yyyy.MM.dd')}</span>}
                          {l.played_date && <span><span style={{ fontWeight:600, marginRight:4 }}>End.</span>{format(new Date(l.played_date),'yyyy.MM.dd')}</span>}
                        </div>
                      )}
                    </div>

                    {l.spoiler_content && <div style={{ fontSize:'0.75rem', color:'#e57373', marginTop:4 }}>⚠️ 스포일러 포함</div>}
                  </div>
                </div>
              ))
            }
          </div>
          <Pagination total={(data.logs||[]).length} perPage={logsPagination.perPage} page={logsPagination.page} onPage={logsPagination.setPage} onPerPage={logsPagination.setPerPage}/>
          <Modal isOpen={!!selectedLog} onClose={()=>setSelectedLog(null)} title={selectedLog?.title}
            footer={<button className="btn btn-outline btn-sm" onClick={()=>setSelectedLog(null)}>닫기</button>}
          >
            {selectedLog && <LogDetailContent detail={selectedLog}/>}
          </Modal>
        </>
      )}

      {/* ── 룰북 ── */}
      {activeTab==='rulebooks' && (() => {
        const parents = (data.rulebooks||[]).filter(r => !r.parent_id)
        const supplMap = {}
        ;(data.rulebooks||[]).filter(r => r.parent_id).forEach(r => {
          if (!supplMap[r.parent_id]) supplMap[r.parent_id] = []
          supplMap[r.parent_id].push(r)
        })

        const RbRow = ({r, isChild}) => (
          <div style={{ display:'flex', alignItems:'center', gap:14, padding: isChild ? '8px 14px 8px 52px' : '10px 14px', background: isChild ? 'var(--color-nav-active-bg)' : 'transparent', borderTop: isChild ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {r.cover_image_url ? <img src={r.cover_image_url} alt={r.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.2rem', opacity:0.35 }}><Mi size='lg' color='light'>menu_book</Mi></span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight: isChild ? 500 : 700, fontSize:'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:6 }}>
                {isChild && <span style={{ fontSize:'0.65rem', color:'var(--color-text-light)', opacity:0.7 }}>└</span>}
                {r.title}
              </div>
              {r.tags?.length > 0 && <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:3 }}>{r.tags.map(t => <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>)}</div>}
            </div>
          </div>
        )
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {!parents.length
              ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>룰북이 없어요</div>
              : parents.map(r => {
                const suppls = supplMap[r.id] || []
                const isOpen = rulebookExpanded[r.id]
                return (
                  <div key={r.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                    {/* 부모 행 - 서플 있으면 클릭으로 토글 */}
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <div style={{ flex:1 }}><RbRow r={r} isChild={false}/></div>
                      {suppls.length > 0 && (
                        <button onClick={() => setRulebookExpanded(e => ({...e, [r.id]:!e[r.id]}))}
                          style={{ background:'none', border:'none', cursor:'pointer', padding:'0 14px', color:'var(--color-text-light)', display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', flexShrink:0 }}>
                          <span>{suppls.length}권</span>
                          <Mi size="sm" color="light">{isOpen ? 'expand_less' : 'expand_more'}</Mi>
                        </button>
                      )}
                    </div>
                    {/* 서플 - 기본 접힘 */}
                    {isOpen && suppls.map(s => <RbRow key={s.id} r={s} isChild={true}/>)}
                  </div>
                )
              })
            }
          </div>
        )
      })()}

      {/* ── 시나리오 ── */}
      {activeTab==='scenarios' && (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {!scenarioParents.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>시나리오가 없어요</div>
            : scenariosPagination.paged.map(s => {
                const children = scenarioChildMap[s.id] || []
                const isOpen = !!scenarioExpanded[s.id]
                const renderScenarioItem = (item, isChild=false) => (
                  <div key={item.id}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 14px',
                      background: isChild ? 'var(--color-nav-active-bg)' : undefined,
                      borderTop: isChild ? '1px solid var(--color-border)' : undefined }}>
                    <div style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0,
                      background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center',
                      justifyContent:'center', border:'1px solid var(--color-border)' }}>
                      {item.cover_image_url
                        ? <img src={item.cover_image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <span style={{ fontSize:'1.1rem', opacity:0.35 }}><Mi size='lg' color='light'>description</Mi></span>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:isChild?'0.85rem':'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:8 }}>
                        {isChild && <Mi size="sm" color="light">subdirectory_arrow_right</Mi>}
                        {item.title}
                        <span className="badge badge-gray" style={{fontSize:'0.65rem'}}>{SCENARIO_STATUS[item.status]}</span>
                      </div>
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        {item.system_name && <span className="text-xs text-light"><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
                        {item.author && <span className="text-xs text-light"><Mi size='sm' color='light'>edit</Mi> {item.author}</span>}
                        {item.player_count && <span className="text-xs text-light"><Mi size="sm" color="light">group</Mi> {item.player_count}</span>}
                      </div>
                      {item.scenario_url && <a href={item.scenario_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.7rem', color:'var(--color-primary)', marginTop:2, display:'block' }}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
                    </div>
                  </div>
                )
                return (
                  <div key={s.id} className="card" style={{padding:0,overflow:'hidden'}}>
                    {renderScenarioItem(s)}
                    {children.length > 0 && (
                      <button style={{width:'100%',background:'none',border:'none',
                        borderTop:'1px solid var(--color-border)',
                        padding:'5px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,
                        color:'var(--color-text-light)',fontSize:'0.78rem'}}
                        onClick={() => setScenarioExpanded(e => ({...e, [s.id]:!e[s.id]}))}>
                        <Mi size='sm' color='light'>{isOpen?'expand_less':'expand_more'}</Mi>
                        {isOpen ? '접기' : `시나리오 ${children.length}개 보기`}
                      </button>
                    )}
                    {isOpen && (
                      <div style={{borderTop:'1px solid var(--color-border)'}}>
                        {children.map(c => renderScenarioItem(c, true))}
                      </div>
                    )}
                  </div>
                )
              })
          }
          </div>
          <Pagination total={scenarioParents.length} perPage={scenariosPagination.perPage} page={scenariosPagination.page} onPage={scenariosPagination.setPage} onPerPage={scenariosPagination.setPerPage}/>
        </>
      )}

      {/* ── 페어 ── */}
      {activeTab==='pairs' && (
        <>
          <div className="grid-auto">
            {!sortedPairs.length
              ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>페어 목록이 없어요</div>
              : pagedPairs.map(p => {
                const dday = calcDday(p.first_met_date)
                return (
                  <div key={p.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                    <div style={{ height:160, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
                      {p.pair_image_url ? <img src={p.pair_image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'4rem', opacity:0.25 }}>👤</span>}
                      {dday !== null && (
                        <div style={{ position:'absolute', top:10, right:10, background:'var(--color-primary)', color:'white', borderRadius:8, padding:'4px 10px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
                          <div style={{ fontSize:'0.6rem', opacity:0.85 }}>함께한 지</div>
                          <div style={{ fontSize:'1.1rem', fontWeight:700, lineHeight:1.2 }}>D+{dday}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding:'12px 14px' }}>
                      <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>{p.name}</div>
                      {p.relations?.length > 0 && (
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                          {p.relations.map(r => <span key={r} className="badge badge-primary">{r}</span>)}
                        </div>
                      )}
                      {p.first_met_date && <div className="text-xs text-light"><Mi size='sm' color='light'>calendar_today</Mi> {p.first_met_date} 첫 만남</div>}
                      {p.memo && <p className="text-xs text-light" style={{ marginTop:8, borderTop:'1px solid var(--color-border)', paddingTop:8 }}>{p.memo}</p>}
                    </div>
                  </div>
                )
              })
            }
          </div>
          <Pagination total={sortedPairs.length} perPage={pairsPagination.perPage} page={pairsPagination.page} onPage={pairsPagination.setPage} onPerPage={pairsPagination.setPerPage}/>
        </>
      )}

      {/* ── 공수표 ── */}
      {activeTab==='availability' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!data.availability?.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>활성화된 공수표가 없어요</div>
            : availabilityPagination.paged.map(a => (
              <div key={a.id} className="card card-sm">
                <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div className="flex gap-8" style={{ flexShrink:0, paddingTop:2 }}>
                    <span className="badge badge-green">활성</span>
                    <span className="badge badge-primary">{a.role}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:4 }}>{a.title}</div>
                    <div className="text-xs text-light flex gap-12" style={{ marginBottom:a.description||a.together_with?5:0 }}>
                      {a.system_name && <span><Mi size='sm' color='light'>sports_esports</Mi> {a.system_name}</span>}
                      {a.together_with && <span>👤 {a.together_with}</span>}
                    </div>
                    {a.description && <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)' }}>{a.description}</p>}
                    {a.scenario_link && <a href={a.scenario_link} target="_blank" rel="noreferrer" style={{ fontSize:'0.78rem', color:'var(--color-primary)', display:'block', marginTop:5 }}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
                  </div>
                </div>
              </div>
            ))
          }
          <Pagination total={(data.availability||[]).length} perPage={availabilityPagination.perPage} page={availabilityPagination.page} onPage={availabilityPagination.setPage} onPerPage={availabilityPagination.setPerPage}/>
        </div>
      )}

      {/* ── 방명록 ── */}
      {activeTab==='guestbook' && <GuestbookPublicView ownerId={profile.id}/>}

      {/* ── 문의/피드백 (관리자 페이지만) ── */}
      {activeTab==='feedback' && profile?.is_admin && <FeedbackPublicView ownerId={profile.id}/>}

      {/* 푸터 */}
      <footer style={{ marginTop:60, paddingTop:20, paddingBottom:20, borderTop:'1px solid var(--color-border)', textAlign:'center', color:'var(--color-text-light)', fontSize:'0.72rem' }}>
        <div style={{marginBottom:10, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
          <button
            onClick={() => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              if (isMobile) window.open('https://qr.kakaopay.com/Ej8h4QBew', '_blank')
              else setKakaoPopup(true)
            }}
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:100,
              background:'rgba(255,235,0,0.12)',border:'1px solid rgba(255,235,0,0.4)',
              color:'#b8960c',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>
            💛 카카오페이로 후원하기
          </button>
          <a href="https://posty.pe/0k44m9" target="_blank" rel="noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:100,
              background:'rgba(200,169,110,0.08)',border:'1px solid var(--color-border)',
              color:'var(--color-accent)',textDecoration:'none',fontSize:'0.75rem',fontWeight:600}}>
            📖 사용설명서 바로가기
          </a>
        </div>
        <div style={{marginBottom:8}}>
          <a href="/privacy" style={{color:'var(--color-text-light)',textDecoration:'none',opacity:0.8}}>
            개인정보 처리방침
          </a>
        </div>
        {FOOTER_TEXT}
      </footer>

      {/* 카카오페이 PC 안내 팝업 */}
      {kakaoPopup && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={() => setKakaoPopup(false)}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:'28px 24px',maxWidth:300,width:'100%',textAlign:'center',border:'1px solid var(--color-border)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:'2rem',marginBottom:10}}>💛</div>
            <p style={{fontWeight:700,fontSize:'0.95rem',marginBottom:8,color:'var(--color-text)'}}>카카오페이 후원</p>
            <p style={{fontSize:'0.82rem',color:'var(--color-text-light)',lineHeight:1.7,marginBottom:16}}>
              모바일 카메라로 QR을 스캔하거나<br/>모바일에서 접속해주세요!
            </p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://qr.kakaopay.com/Ej8h4QBew"
              alt="카카오페이 QR" style={{width:140,height:140,borderRadius:8,marginBottom:16,border:'1px solid var(--color-border)'}}/>
            <button className="btn btn-outline btn-sm" style={{justifyContent:'center',width:'100%'}}
              onClick={() => setKakaoPopup(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}
