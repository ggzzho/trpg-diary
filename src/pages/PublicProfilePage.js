// src/pages/PublicProfilePage.js
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
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
const FORMAT_MAP = { physical:'실물', digital:'전자', both:'실물+전자', physical_soft:'실물(소프트)', physical_hard:'실물(하드)', digital_purchase:'전자', digital_free:'전자', physical_digital:'실물+전자', other:'기타' }

function calcDday(d) {
  if (!d) return null
  return Math.floor((new Date() - new Date(d)) / 86400000) + 1
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

// hex → rgba 변환
const hexToRgba = (hex, alpha) => {
  const h = hex.replace('#','')
  const r = parseInt(h.slice(0,2),16)
  const g = parseInt(h.slice(2,4),16)
  const b = parseInt(h.slice(4,6),16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── 미니 캘린더 ──
function PublicCalendar({ schedules, blocked = [], colorMap = {} }) {
  const [tooltip, setTooltip] = useState(null) // { date, scheds, x, y }

  // 모바일: 툴팁 외부 터치 시 닫기
  React.useEffect(() => {
    if (!tooltip) return
    const handler = () => setTooltip(null)
    document.addEventListener('touchstart', handler)
    return () => document.removeEventListener('touchstart', handler)
  }, [!!tooltip])
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
      const hasAllDayBlocked = dayBlocked.some(b => !b.blocked_from)
      const cellItems = [
        ...dayScheds.map(x => ({...x, _time: x.scheduled_time||'', _kind:'session'})),
        ...dayBlocked.map(x => ({...x, _time: x.blocked_from||'', _kind:'blocked'}))
      ].sort((a,b) => a._time.localeCompare(b._time))
      const hasMore = cellItems.length > 3
      week.push(
        <div key={dStr}
          className={`calendar-cell ${isToday(d)?'today':''} ${!isSameMonth(d,cal)?'other-month':''}`}
          style={{ cursor: hasMore ? 'pointer' : 'default', outline: hasAllDayBlocked ? '2px solid #e57373' : 'none', outlineOffset:'-2px', position:'relative' }}
          onMouseEnter={hasMore ? e => {
            const r = e.currentTarget.getBoundingClientRect()
            setTooltip({ date: dStr, items: cellItems, x: r.left, y: r.bottom })
          } : undefined}
          onMouseLeave={hasMore ? () => setTooltip(null) : undefined}
          onTouchEnd={hasMore ? e => {
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            setTooltip(prev => prev?.date === dStr ? null : { date: dStr, items: cellItems, x: r.left, y: r.bottom })
          } : undefined}
        >
          <div className="calendar-date">{format(d,'d')}</div>
          {cellItems.slice(0,3).map((item,idx) => {
            if (item._kind === 'blocked') return (
              <div key={`bl${idx}`}
                style={{ fontSize:'0.65rem', padding:'1px 3px', borderRadius:3, marginBottom:2,
                  background:'rgba(229,115,115,0.15)', color:'#e57373',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                title={item.blocked_from && item.blocked_until ? `${item.blocked_from.slice(0,5)}~${item.blocked_until.slice(0,5)}` : item.blocked_from ? `${item.blocked_from.slice(0,5)}~` : ''}
              >
                🚫 {item.blocked_from ? `${item.blocked_from.slice(0,5)}${item.blocked_until?`~${item.blocked_until.slice(0,5)}`:'~'}` : '종일'}
              </div>
            )
            const evColor = colorMap?.[item.system_name]
            const colorStyle = evColor ? { background: item.is_gm ? hexToRgba(evColor,1.0) : hexToRgba(evColor,0.7), color:'white' } : {}
            return (
              <div key={idx} className={`calendar-event${!evColor&&item.is_gm?' gm':''}`} style={colorStyle} title={item.title}>
                {item.scheduled_time && <span style={{ opacity:0.85, marginRight:2 }}>{item.scheduled_time.slice(0,5)}</span>}
                {item.title}
              </div>
            )
          })}
          {hasMore && (
            <div style={{ fontSize:'0.55rem', color:'var(--color-primary)', paddingLeft:2, fontWeight:600 }}>+{cellItems.length-3}개 더 ▾</div>
          )}
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(<React.Fragment key={day.toString()}>{week}</React.Fragment>)
  }
  return (
    <>
      <div className="card">
        <div className="flex justify-between items-center" style={{ marginBottom:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCal(subMonths(cal,1))}>‹ 이전</button>
          <span style={{ fontWeight:700, fontSize:'1rem', color:'var(--color-accent)' }}>{format(cal,'yyyy년 M월',{locale:ko})}</span>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setCal(addMonths(cal,1))}>다음 ›</button>
            <button className="btn btn-outline btn-sm" onClick={()=>setCal(new Date())} style={{ fontSize:'0.75rem', padding:'3px 10px' }}>오늘</button>
          </div>
        </div>
        <div className="calendar-grid" style={{ marginBottom:3 }}>
          {['일','월','화','수','목','금','토'].map((d,i) => (
            <div key={d} className="calendar-day-header"
              style={{ color: i===0?'#e57373':i===6?'#6b8cba':'var(--color-text-light)' }}>{d}</div>
          ))}
        </div>
        <div className="calendar-grid">{rows}</div>
      </div>
      {tooltip && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:9998, pointerEvents:'none' }} />
          <div
            onMouseEnter={() => {}}
            onMouseLeave={() => setTooltip(null)}
            onTouchStart={e => e.stopPropagation()}
            style={{
              position:'fixed', left: Math.min(tooltip.x, window.innerWidth - 230),
              top: tooltip.y + 4, zIndex:9999,
              background:'var(--color-surface)', border:'1px solid var(--color-border)',
              borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
              minWidth:190, maxWidth:250, padding:'10px 12px'
            }}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--color-accent)' }}>
                {format(new Date(tooltip.date), 'M월 d일', {locale:ko})} 일정
              </span>
              <button onClick={()=>setTooltip(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-light)', fontSize:'0.9rem', lineHeight:1, padding:'0 2px' }}>×</button>
            </div>
            {(tooltip.items||[]).map((item,i) => {
              if (item._kind === 'blocked') return (
                <div key={i} style={{ marginBottom:3, fontSize:'0.75rem', padding:'1px 4px', borderRadius:3, background:'rgba(229,115,115,0.15)', color:'#e57373' }}>
                  🚫 {item.blocked_from ? `${item.blocked_from.slice(0,5)}${item.blocked_until?`~${item.blocked_until.slice(0,5)}`:'~'}` : '종일'}
                </div>
              )
              const evColor = colorMap?.[item.system_name]
              return (
                <div key={i} className={`calendar-event${!evColor&&item.is_gm?' gm':''}`}
                  style={{ marginBottom:3, fontSize:'0.75rem', ...(evColor ? { background: item.is_gm ? hexToRgba(evColor,1.0) : hexToRgba(evColor,0.7), color:'white' } : {}) }}>
                  {item.scheduled_time && <span style={{ opacity:0.8, marginRight:4 }}>{item.scheduled_time.slice(0,5)}</span>}
                  {item.title}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
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
  const [wishScenarioExpanded, setWishScenarioExpanded] = useState({})
  const [kakaoPopup, setKakaoPopup] = useState(false)
  const [viewDark, setViewDark] = useState(false)
  const [tabSearch, setTabSearch] = useState('')
  // 공개 페이지 페어 히스토리 뷰
  const [pairHistoriesMap, setPairHistoriesMap] = useState({})
  const [pubHistoryViewPair, setPubHistoryViewPair] = useState(null)
  const [pubHistoryViewSearch, setPubHistoryViewSearch] = useState('')
  const [pubHistoryViewPage, setPubHistoryViewPage] = useState(1)
  // 탭별 lazy load
  const [counts, setCounts] = useState({})
  const [tabLoading, setTabLoading] = useState({})
  const loadedRef = useRef(new Set())

  // 페이지네이션 - Hook이므로 early return 전에 선언 필수
  const publicLogs = (data.logs||[]).filter(l => !l.is_private)
  const filteredLogs = useMemo(() => {
    if (!tabSearch) return publicLogs
    const s = tabSearch.toLowerCase()
    return publicLogs.filter(l =>
      (l.title||'').toLowerCase().includes(s) ||
      (l.system_name||'').toLowerCase().includes(s) ||
      (l.series_tag||'').toLowerCase().includes(s) ||
      (l.character_name||'').toLowerCase().includes(s) ||
      (l.together_with||'').toLowerCase().includes(s)
    )
  }, [publicLogs, tabSearch])
  const logsPagination = usePagination(filteredLogs, 20)

  const scenarioParents = [...(data.scenarios||[]).filter(s => !s.parent_id)].sort((a,b) => {
    const ta=(a.title||'').toLowerCase(), tb=(b.title||'').toLowerCase()
    return (profile?.scenario_sort_order||'asc')==='asc' ? ta.localeCompare(tb,'ko') : tb.localeCompare(ta,'ko')
  })
  const scenarioChildMap = (data.scenarios||[]).filter(s => !!s.parent_id).reduce((m,s) => {
    if (!m[s.parent_id]) m[s.parent_id] = []
    m[s.parent_id].push(s)
    return m
  }, {})
  const filteredScenarioParents = useMemo(() => {
    if (!tabSearch) return scenarioParents
    const s = tabSearch.toLowerCase()
    return scenarioParents.filter(p =>
      (p.title||'').toLowerCase().includes(s) ||
      (p.system_name||'').toLowerCase().includes(s) ||
      (p.author||'').toLowerCase().includes(s) ||
      (scenarioChildMap[p.id]||[]).some(c =>
        (c.title||'').toLowerCase().includes(s) || (c.system_name||'').toLowerCase().includes(s)
      )
    )
  }, [scenarioParents, scenarioChildMap, tabSearch])
  const scenariosPagination = usePagination(filteredScenarioParents, 20)

  const sortedAvailability = [...(data.availability||[])].sort((a,b) => {
    const ta=(a.title||'').toLowerCase(), tb=(b.title||'').toLowerCase()
    return (profile?.availability_sort_order||'asc')==='asc' ? ta.localeCompare(tb,'ko') : tb.localeCompare(ta,'ko')
  })
  const filteredAvailability = useMemo(() => {
    if (!tabSearch) return sortedAvailability
    const s = tabSearch.toLowerCase()
    return sortedAvailability.filter(a =>
      (a.title||'').toLowerCase().includes(s) ||
      (a.system_name||'').toLowerCase().includes(s) ||
      (a.description||'').toLowerCase().includes(s) ||
      (a.together_with||'').toLowerCase().includes(s)
    )
  }, [sortedAvailability, tabSearch])
  const availabilityPagination = usePagination(filteredAvailability, 20)

  const sortedBookmarks = [...(data.bookmarks||[])].sort((a,b) => {
    const ta=(a.title||'').toLowerCase(), tb=(b.title||'').toLowerCase()
    return (profile?.bookmark_sort_order||'asc')==='asc' ? ta.localeCompare(tb,'ko') : tb.localeCompare(ta,'ko')
  })
  const filteredBookmarks = useMemo(() => {
    if (!tabSearch) return sortedBookmarks
    const s = tabSearch.toLowerCase()
    return sortedBookmarks.filter(b =>
      (b.title||'').toLowerCase().includes(s) ||
      (b.description||'').toLowerCase().includes(s) ||
      b.tags?.some(t => t.toLowerCase().includes(s))
    )
  }, [sortedBookmarks, tabSearch])
  const bookmarksPagination = usePagination(filteredBookmarks, 20)

  const sortedFilteredPairs = useMemo(() => {
    const sorted = [...(data.pairs||[])].sort((a,b) => {
      const da=a.first_met_date||'', db=b.first_met_date||''
      const noA=!a.first_met_date, noB=!b.first_met_date
      if (noA && noB) return pairSort==='asc'?(a.name||'').localeCompare(b.name||'','ko'):(b.name||'').localeCompare(a.name||'','ko')
      if (noA) return 1; if (noB) return -1
      return pairSort==='asc'?da.localeCompare(db):db.localeCompare(da)
    })
    if (!tabSearch) return sorted
    const s = tabSearch.toLowerCase()
    return sorted.filter(p =>
      (p.name||'').toLowerCase().includes(s) ||
      (p.memo||'').toLowerCase().includes(s) ||
      (p.relations||[]).some(r => r.toLowerCase().includes(s))
    )
  }, [data.pairs, pairSort, tabSearch])
  const pairsPagination = usePagination(sortedFilteredPairs, 20)

  const pubHistoryViewLogs = useMemo(() => {
    if (!pubHistoryViewPair) return []
    const s = pubHistoryViewSearch.toLowerCase()
    const list = pairHistoriesMap[pubHistoryViewPair.id] || []
    if (!s) return list
    return list.filter(h =>
      (h.title||'').toLowerCase().includes(s) ||
      (h.system_name||'').toLowerCase().includes(s) ||
      (h.played_date||'').includes(s)
    )
  }, [pubHistoryViewPair, pubHistoryViewSearch, pairHistoriesMap])
  const PHV_PER_PAGE = 10
  const phvTotalPages = Math.ceil(pubHistoryViewLogs.length / PHV_PER_PAGE) || 1
  const phvPaged = pubHistoryViewLogs.slice((pubHistoryViewPage-1)*PHV_PER_PAGE, pubHistoryViewPage*PHV_PER_PAGE)

  const wishScenarioParents = [...(data.wish_scenarios||[]).filter(s => !s.parent_id)].sort((a,b) =>
    (a.title||'').toLowerCase().localeCompare((b.title||'').toLowerCase(),'ko')
  )
  const wishScenarioChildMap = (data.wish_scenarios||[]).filter(s => !!s.parent_id).reduce((m,s) => {
    if (!m[s.parent_id]) m[s.parent_id] = []
    m[s.parent_id].push(s)
    return m
  }, {})
  const filteredWishScenarioParents = useMemo(() => {
    if (!tabSearch) return wishScenarioParents
    const s = tabSearch.toLowerCase()
    return wishScenarioParents.filter(p =>
      (p.title||'').toLowerCase().includes(s) ||
      (p.system_name||'').toLowerCase().includes(s) ||
      (p.author||'').toLowerCase().includes(s) ||
      (wishScenarioChildMap[p.id]||[]).some(c =>
        (c.title||'').toLowerCase().includes(s) || (c.system_name||'').toLowerCase().includes(s)
      )
    )
  }, [wishScenarioParents, wishScenarioChildMap, tabSearch])
  const wishScenariosPagination = usePagination(filteredWishScenarioParents, 20)

  const sortedDotori = [...(data.dotori||[])].sort((a,b) =>
    (a.title||'').toLowerCase().localeCompare((b.title||'').toLowerCase(),'ko')
  )
  const filteredDotori = useMemo(() => {
    if (!tabSearch) return sortedDotori
    const s = tabSearch.toLowerCase()
    return sortedDotori.filter(d =>
      (d.title||'').toLowerCase().includes(s) ||
      (d.description||'').toLowerCase().includes(s) ||
      (d.system_name||'').toLowerCase().includes(s) ||
      d.tags?.some(t => t.toLowerCase().includes(s))
    )
  }, [sortedDotori, tabSearch])
  const dotoriPagination = usePagination(filteredDotori, 20)

  // 공개 캘린더용 colorMap: 해당 유저의 룰북 title → color
  // ⚠️ Hook이므로 early return 전에 선언 필수
  const publicColorMap = useMemo(() => {
    const m = {}
    ;(data.rulebooks||[]).filter(r => !r.parent_id && r.color).forEach(r => { m[r.title] = r.color })
    return m
  }, [data.rulebooks])

  const loadTabData = async (tab, profileId) => {
    if (loadedRef.current.has(tab)) return
    if (['guestbook','feedback'].includes(tab)) { loadedRef.current.add(tab); return }
    loadedRef.current.add(tab)
    setTabLoading(t => ({...t, [tab]: true}))
    const safeQ = async p => { try { const r = await p; return r.data || [] } catch { return [] } }
    let updates = {}
    if (tab === 'schedules') {
      const today = new Date().toISOString().split('T')[0]
      const [schedsAll, rbooks] = await Promise.all([
        safeQ(supabase.from('schedules').select('*').eq('user_id',profileId).order('scheduled_date').limit(2500)),
        loadedRef.current.has('rulebooks')
          ? Promise.resolve(null)
          : safeQ(supabase.from('rulebooks').select('*').eq('user_id',profileId).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}).limit(2500))
      ])
      updates.schedules = schedsAll.filter(s => s.entry_type !== 'blocked' && s.status !== 'cancelled' && s.status !== 'completed' && s.scheduled_date >= today)
      updates.blocked = schedsAll.filter(s => s.entry_type === 'blocked')
      if (rbooks !== null) { updates.rulebooks = rbooks; loadedRef.current.add('rulebooks') }
    } else if (tab === 'logs') {
      updates.logs = await safeQ(supabase.from('play_logs').select('*').eq('user_id',profileId).order('played_date',{ascending:false,nullsFirst:false}).limit(2500))
    } else if (tab === 'rulebooks') {
      updates.rulebooks = await safeQ(supabase.from('rulebooks').select('*').eq('user_id',profileId).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}).limit(2500))
    } else if (tab === 'scenarios') {
      updates.scenarios = await safeQ(supabase.from('scenarios').select('*').eq('user_id',profileId).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true}).limit(2500))
    } else if (tab === 'wish_scenarios') {
      updates.wish_scenarios = await safeQ(supabase.from('wish_scenarios').select('*').eq('user_id',profileId).order('created_at',{ascending:true}).limit(2500))
    } else if (tab === 'dotori') {
      updates.dotori = await safeQ(supabase.from('dotori').select('*').eq('user_id',profileId).order('title').limit(2500))
    } else if (tab === 'pairs') {
      updates.pairs = await safeQ(pairsApi.getAll(profileId))
    } else if (tab === 'availability') {
      updates.availability = await safeQ(supabase.from('availability').select('*').eq('user_id',profileId).eq('is_active',true).limit(2500))
    } else if (tab === 'bookmarks') {
      updates.bookmarks = await safeQ(supabase.from('bookmarks').select('*').eq('user_id',profileId).order('title').limit(2500))
    }
    setData(d => ({...d, ...updates}))
    setTabLoading(t => ({...t, [tab]: false}))
  }

  useEffect(() => {
    const load = async () => {
      const { data:p, error } = await getProfile(username)
      if (error || !p) { setNotFound(true); setLoading(false); return }
      setProfile(p)

      if (p.pair_sort_order) setPairSort(p.pair_sort_order)
      const saved = localStorage.getItem(`trpg_view_${username}`)
      setViewDark(saved !== null ? saved === 'dark' : (p.dark_mode || false))

      // 탭 카운트 + 통계용 경량 head 쿼리
      const today = new Date().toISOString().split('T')[0]
      const safeC = async pr => { try { const r = await pr; return r.count || 0 } catch { return 0 } }
      const [logsCount, rulebooksCount, scenariosCount, wishCount, dotoriCount, pairsCount, schedsCount, availCount, guestbookCount, bookmarksCount] = await Promise.all([
        safeC(supabase.from('play_logs').select('id',{count:'exact',head:true}).eq('user_id',p.id).eq('is_private',false)),
        safeC(supabase.from('rulebooks').select('id',{count:'exact',head:true}).eq('user_id',p.id).is('parent_id',null)),
        safeC(supabase.from('scenarios').select('id',{count:'exact',head:true}).eq('user_id',p.id)),
        safeC(supabase.from('wish_scenarios').select('id',{count:'exact',head:true}).eq('user_id',p.id)),
        safeC(supabase.from('dotori').select('id',{count:'exact',head:true}).eq('user_id',p.id)),
        safeC(supabase.from('pairs').select('id',{count:'exact',head:true}).eq('user_id',p.id)),
        safeC(supabase.from('schedules').select('id',{count:'exact',head:true}).eq('user_id',p.id).neq('entry_type','blocked').neq('status','cancelled').neq('status','completed').gte('scheduled_date',today)),
        safeC(supabase.from('availability').select('id',{count:'exact',head:true}).eq('user_id',p.id).eq('is_active',true)),
        safeC(supabase.from('guestbook').select('id',{count:'exact',head:true}).eq('owner_id',p.id)),
        safeC(supabase.from('bookmarks').select('id',{count:'exact',head:true}).eq('user_id',p.id)),
      ])
      setCounts({ logs:logsCount, rulebooks:rulebooksCount, scenarios:scenariosCount, wish_scenarios:wishCount, dotori:dotoriCount, pairs:pairsCount, schedule:schedsCount, availability:availCount, guestbook:guestbookCount, bookmarks:bookmarksCount })

      const hidden = p.hidden_tabs || []
      const allTabKeys = ['schedules','rulebooks','logs','availability','scenarios','wish_scenarios','dotori','pairs','bookmarks','guestbook']
      const requestedTab = searchParams.get('tab') || 'schedules'
      let initialTab = requestedTab
      if (hidden.includes(requestedTab)) {
        initialTab = allTabKeys.find(k => !hidden.includes(k)) || 'guestbook'
        setActiveTab(initialTab)
      }

      setLoading(false)
      await loadTabData(initialTab, p.id)
    }
    load()
  }, [username])

  // profile 또는 viewDark 변경 시 테마 재적용 (오너 설정 + 방문자 뷰모드 반영)
  useEffect(() => {
    if (!profile) return
    applyTheme(
      profile.theme_color||'#c8a96e',
      profile.theme_bg_color||'#faf6f0',
      profile.theme_accent||'#8b6f47',
      profile.theme_text_color||null,
      viewDark
    )
    applyBackground(
      profile.background_image_url||'',
      profile.bg_opacity !== undefined ? profile.bg_opacity : 1,
      viewDark,
      profile.theme_color||'#c8a96e'
    )
  }, [profile, viewDark])

  // 페이지 떠날 때 탭 제목 복원
  useEffect(() => {
    return () => { document.title = 'TRPG Diary ✦' }
  }, [])

  const loadPairHistories = async (pairId) => {
    const { data } = await supabase.from('pair_histories')
      .select('id, play_log_id, play_logs(id,title,played_date,system_name,role)')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: false })
    setPairHistoriesMap(m => ({ ...m, [pairId]: (data||[]).map(r => ({ history_id: r.id, ...r.play_logs })) }))
  }
  const openPubHistoryView = async (pair) => {
    setPubHistoryViewPair(pair)
    setPubHistoryViewSearch('')
    setPubHistoryViewPage(1)
    if (pairHistoriesMap[pair.id] === undefined) await loadPairHistories(pair.id)
  }

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
    { key:'schedules', label:'일정', icon:'calendar_month', count: data.schedules?.length ?? counts.schedule },
    { key:'rulebooks', label:'룰북', icon:'menu_book', count: data.rulebooks !== undefined ? (data.rulebooks||[]).filter(r=>!r.parent_id).length : counts.rulebooks },
    { key:'logs', label:'기록', icon:'auto_stories', count: data.logs !== undefined ? publicLogs.length : counts.logs },
    { key:'availability', label:'공수표', icon:'event_available', count: data.availability?.length ?? counts.availability },
    { key:'scenarios', label:'보유 시나리오', icon:'description', count: data.scenarios !== undefined ? scenarioParents.length : counts.scenarios },
    { key:'wish_scenarios', label:'위시 시나리오', icon:'favorite', count: data.wish_scenarios !== undefined ? wishScenarioParents.length : counts.wish_scenarios },
    { key:'dotori', label:'도토리', icon:'forest', count: data.dotori?.length ?? counts.dotori },
    { key:'pairs', label:'페어', icon:'people', count: data.pairs?.length ?? counts.pairs },
    { key:'bookmarks', label:'북마크', icon:'bookmark', count: data.bookmarks?.length ?? counts.bookmarks },
    { key:'guestbook', label:'방명록', icon:'mail', count: counts.guestbook },
    ...(profile?.is_admin ? [{ key:'feedback', label:'문의/피드백', icon:'support_agent' }] : []),
  ].filter(t => !hiddenTabs.includes(t.key))

  const pagedPairs = pairsPagination.paged

  const ogTitle = profile ? `${profile.display_name || profile.username}의 TRPG Diary` : 'TRPG Diary ✦'
  const ogDesc  = profile?.play_style || (profile ? `${profile.display_name || profile.username}님의 TRPG 다이어리 - trpg-diary.co.kr` : '나만의 TRPG Diary')
  const ogImage = profile?.header_image_url || profile?.avatar_url || 'https://trpg-diary.co.kr/og-image.png'
  const ogUrl   = `https://trpg-diary.co.kr/u/${username}`

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 20px 0' }}>
      <Helmet>
        <title>{ogTitle}</title>
        <meta property="og:type"        content="profile" />
        <meta property="og:title"       content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image"       content={ogImage} />
        <meta property="og:url"         content={ogUrl} />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image"       content={ogImage} />
      </Helmet>

      {/* 다크/라이트 모드 토글 - 방문자가 직접 선택 */}
      {profile && (
        <div
          onClick={() => {
            const next = !viewDark
            setViewDark(next)
            localStorage.setItem(`trpg_view_${username}`, next ? 'dark' : 'light')
          }}
          style={{
            position:'fixed', bottom:68, right:20, zIndex:9999,
            width:36, height:36, borderRadius:'50%',
            background: viewDark ? 'rgba(30,30,30,0.75)' : 'var(--color-primary)',
            color:'white', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 12px rgba(0,0,0,0.2)',
            backdropFilter:'blur(8px)',
            transition:'opacity 0.15s',
            border: viewDark ? '1px solid rgba(255,255,255,0.15)' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity='1'}
          title={viewDark ? '라이트 모드로 보기' : '다크 모드로 보기'}
        >
          <Mi size='sm' color='white'>{viewDark ? 'light_mode' : 'dark_mode'}</Mi>
        </div>
      )}

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
          {(() => {
            const ALL_PUBLIC_STATS = [
              {key:'logs', label:'기록', v: data.logs !== undefined ? publicLogs.length : (counts.logs||0)},
              {key:'rulebooks', label:'룰북', v: data.rulebooks !== undefined ? (data.rulebooks||[]).filter(r=>!r.parent_id).length : (counts.rulebooks||0)},
              {key:'scenarios', label:'보유 시나리오', v: data.scenarios?.length || (counts.scenarios||0)},
              {key:'wish_scenarios', label:'위시 시나리오', v: data.wish_scenarios?.length || (counts.wish_scenarios||0)},
              {key:'dotori', label:'도토리', v: data.dotori?.length || (counts.dotori||0)},
              {key:'pairs', label:'페어', v: data.pairs?.length || (counts.pairs||0)},
              {key:'schedule', label:'일정', v: data.schedules?.length || (counts.schedule||0)},
              {key:'availability', label:'공수표', v: data.availability?.length || (counts.availability||0)},
              {key:'guestbook', label:'방명록', v: counts.guestbook||0},
              {key:'bookmarks', label:'북마크', v: data.bookmarks?.length || (counts.bookmarks||0)},
            ]
            const dashCards = profile?.dashboard_cards || ['logs','rulebooks','scenarios','pairs']
            const publicStats = ALL_PUBLIC_STATS.filter(s=>dashCards.includes(s.key))
            return (
              <div className="flex justify-between" style={{ marginTop:16, padding:'12px 0', borderTop:'1px solid var(--color-border)', borderBottom:'1px solid var(--color-border)' }}>
                {publicStats.map(s => (
                  <div key={s.key} style={{ textAlign:'center', flex:1 }}>
                    <div style={{ fontSize:'1.3rem', color:'var(--color-accent)', fontWeight:700 }}>{s.v}</div>
                    <div className="text-xs text-light">{s.label}</div>
                  </div>
                ))}
              </div>
            )
          })()}

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
      <div className="flex gap-8" style={{ marginBottom:12, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key}
            className={`btn btn-sm ${activeTab===t.key?'btn-primary':'btn-outline'}`}
            onClick={() => { setActiveTab(t.key); setTabSearch(''); loadTabData(t.key, profile.id) }}
            style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Mi size="sm" color={activeTab===t.key?'white':'accent'}>{t.icon}</Mi>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* 탭 검색바 (일정·방명록·피드백 제외) */}
      {!['schedules','guestbook','feedback'].includes(activeTab) && !tabLoading[activeTab] && (
        <div style={{ marginBottom:16 }}>
          <input className="form-input" placeholder="검색..." value={tabSearch} onChange={e => setTabSearch(e.target.value)} style={{ maxWidth:320 }}/>
        </div>
      )}

      {/* 탭별 로딩 인디케이터 */}
      {tabLoading[activeTab] && (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--color-text-light)', fontSize:'0.85rem' }}>
          불러오는 중...
        </div>
      )}

      {/* ── 일정 (캘린더) ── */}
      {!tabLoading[activeTab] && activeTab==='schedules' && <PublicCalendar schedules={data.schedules||[]} blocked={data.blocked||[]} colorMap={publicColorMap}/>}

      {/* ── 기록 (카드 + 팝업) ── */}
      {!tabLoading[activeTab] && activeTab==='logs' && (
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
          <Pagination total={filteredLogs.length} perPage={logsPagination.perPage} page={logsPagination.page} onPage={logsPagination.setPage} onPerPage={logsPagination.setPerPage}/>
          <Modal isOpen={!!selectedLog} onClose={()=>setSelectedLog(null)} title={selectedLog?.title}
            footer={<button className="btn btn-outline btn-sm" onClick={()=>setSelectedLog(null)}>닫기</button>}
          >
            {selectedLog && <LogDetailContent detail={selectedLog}/>}
          </Modal>
        </>
      )}

      {/* ── 룰북 ── */}
      {!tabLoading[activeTab] && activeTab==='rulebooks' && (() => {
        const allRbParents = (data.rulebooks||[]).filter(r => !r.parent_id)
        const parents = tabSearch
          ? (() => { const s=tabSearch.toLowerCase(); return allRbParents.filter(r=>(r.title||'').toLowerCase().includes(s)||(r.publisher||'').toLowerCase().includes(s)||r.tags?.some(t=>t.toLowerCase().includes(s))) })()
          : allRbParents
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
                {r.publisher && <span className="text-xs text-light" style={{ fontWeight:400 }}>{r.publisher}</span>}
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
      {!tabLoading[activeTab] && activeTab==='scenarios' && (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {!scenarioParents.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>보유 시나리오가 없어요</div>
            : scenariosPagination.paged.map(s => { // paged from filteredScenarioParents
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
                      <div style={{ fontWeight: isChild ? 500 : 700, fontSize:isChild?'0.85rem':'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        {item.title}
                        {(item.status_tags||[]).map(t => (
                          <span key={t} style={{padding:'1px 7px',borderRadius:100,fontSize:'0.65rem',fontWeight:600,
                            background:'var(--color-nav-active-bg)',color:'var(--color-accent)',border:'1px solid var(--color-border)',whiteSpace:'nowrap'}}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        {item.system_name && <span className="text-xs text-light"><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
                        {item.author && <span className="text-xs text-light"><Mi size='sm' color='light'>edit</Mi> {item.author}</span>}
                        {item.player_count && <span className="text-xs text-light"><Mi size="sm" color="light">group</Mi> {item.player_count}</span>}
                        {item.format && <span className="text-xs text-light"><Mi size='sm' color='light'>inventory_2</Mi> {FORMAT_MAP[item.format]||item.format}</span>}
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
          <Pagination total={filteredScenarioParents.length} perPage={scenariosPagination.perPage} page={scenariosPagination.page} onPage={scenariosPagination.setPage} onPerPage={scenariosPagination.setPerPage}/>
        </>
      )}

      {/* ── 위시 시나리오 ── */}
      {!tabLoading[activeTab] && activeTab==='wish_scenarios' && (() => {
        const renderWishItem = (item, isChild=false) => (
          <div key={item.id}
            style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 14px',
              background: isChild ? 'var(--color-nav-active-bg)' : undefined,
              borderTop: isChild ? '1px solid var(--color-border)' : undefined }}>
            <div style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0,
              background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center',
              justifyContent:'center', border:'1px solid var(--color-border)' }}>
              {item.cover_image_url
                ? <img src={item.cover_image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <span style={{ fontSize:'1.1rem', opacity:0.35 }}><Mi size='lg' color='light'>favorite</Mi></span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight: isChild ? 500 : 700, fontSize:isChild?'0.85rem':'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                {item.title}
                {(item.status_tags||[]).map(t => (
                  <span key={t} style={{padding:'1px 7px',borderRadius:100,fontSize:'0.65rem',fontWeight:600,
                    background:'var(--color-nav-active-bg)',color:'var(--color-accent)',border:'1px solid var(--color-border)',whiteSpace:'nowrap'}}>
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {item.system_name && <span className="text-xs text-light"><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
                {item.author && <span className="text-xs text-light"><Mi size='sm' color='light'>edit</Mi> {item.author}</span>}
                {item.player_count && <span className="text-xs text-light"><Mi size="sm" color="light">group</Mi> {item.player_count}</span>}
                {item.format && <span className="text-xs text-light"><Mi size='sm' color='light'>inventory_2</Mi> {FORMAT_MAP[item.format]||item.format}</span>}
              </div>
              {item.scenario_url && <a href={item.scenario_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.7rem', color:'var(--color-primary)', marginTop:2, display:'block' }}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
            </div>
          </div>
        )
        return (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {!wishScenarioParents.length
                ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>위시 시나리오가 없어요</div>
                : wishScenariosPagination.paged.map(s => {
                    const children = wishScenarioChildMap[s.id] || []
                    const isOpen = !!wishScenarioExpanded[s.id]
                    return (
                      <div key={s.id} className="card" style={{padding:0,overflow:'hidden'}}>
                        {renderWishItem(s)}
                        {children.length > 0 && (
                          <button style={{width:'100%',background:'none',border:'none',
                            borderTop:'1px solid var(--color-border)',
                            padding:'5px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,
                            color:'var(--color-text-light)',fontSize:'0.78rem'}}
                            onClick={() => setWishScenarioExpanded(e => ({...e, [s.id]:!e[s.id]}))}>
                            <Mi size='sm' color='light'>{isOpen?'expand_less':'expand_more'}</Mi>
                            {isOpen ? '접기' : `시나리오 ${children.length}개 보기`}
                          </button>
                        )}
                        {isOpen && (
                          <div style={{borderTop:'1px solid var(--color-border)'}}>
                            {children.map(c => renderWishItem(c, true))}
                          </div>
                        )}
                      </div>
                    )
                  })
              }
            </div>
            <Pagination total={filteredWishScenarioParents.length} perPage={wishScenariosPagination.perPage} page={wishScenariosPagination.page} onPage={wishScenariosPagination.setPage} onPerPage={wishScenariosPagination.setPerPage}/>
          </>
        )
      })()}

      {/* ── 도토리 ── */}
      {!tabLoading[activeTab] && activeTab==='dotori' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!sortedDotori.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>도토리가 없어요</div>
            : dotoriPagination.paged.map(d => (
              <div key={d.id} className="card card-sm" style={{ display:'flex', alignItems:'center', gap:14 }}>
                {d.thumbnail_url
                  ? <img src={d.thumbnail_url} alt={d.title} style={{ width:48, height:48, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>
                  : <div style={{ width:48, height:48, borderRadius:8, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Mi color="light">forest</Mi>
                    </div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.title||'제목 없음'}</div>
                  {d.tags?.length > 0 && (
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:3 }}>
                      {d.tags.map(t => <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>)}
                    </div>
                  )}
                  {d.description && <p style={{ fontSize:'0.78rem', color:'var(--color-text-light)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.description}</p>}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    {d.system_name
                      ? <span style={{ fontSize:'0.7rem', color:'var(--color-accent)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}><Mi size='sm' color='accent'>menu_book</Mi> {d.system_name}</span>
                      : <span/>
                    }
                    {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize:'0.72rem', color:'var(--color-primary)', flexShrink:0 }}>
                      <Mi size='sm'>link</Mi> 링크 열기
                    </a>}
                  </div>
                </div>
              </div>
            ))
          }
          <Pagination total={filteredDotori.length} perPage={dotoriPagination.perPage} page={dotoriPagination.page} onPage={dotoriPagination.setPage} onPerPage={dotoriPagination.setPerPage}/>
        </div>
      )}

      {/* ── 페어 ── */}
      {!tabLoading[activeTab] && activeTab==='pairs' && (
        <>
          <div className="grid-auto">
            {!sortedFilteredPairs.length
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
                    <div style={{ padding:'8px 14px', borderTop:'1px solid var(--color-border)' }}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openPubHistoryView(p)}>
                        <Mi size='sm'>history</Mi> 히스토리{pairHistoriesMap[p.id]!==undefined&&` (${pairHistoriesMap[p.id].length})`}
                      </button>
                    </div>
                  </div>
                )
              })
            }
          </div>
          <Pagination total={sortedFilteredPairs.length} perPage={pairsPagination.perPage} page={pairsPagination.page} onPage={pairsPagination.setPage} onPerPage={pairsPagination.setPerPage}/>
        </>
      )}

      {/* ── 공수표 ── */}
      {!tabLoading[activeTab] && activeTab==='availability' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!sortedAvailability.length
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
          <Pagination total={filteredAvailability.length} perPage={availabilityPagination.perPage} page={availabilityPagination.page} onPage={availabilityPagination.setPage} onPerPage={availabilityPagination.setPerPage}/>
        </div>
      )}

      {/* ── 북마크 ── */}
      {!tabLoading[activeTab] && activeTab==='bookmarks' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!sortedBookmarks.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>북마크가 없어요</div>
            : bookmarksPagination.paged.map(b => (
              <div key={b.id} className="card card-sm" style={{ display:'flex', alignItems:'center', gap:14 }}>
                {b.thumbnail_url
                  ? <img src={b.thumbnail_url} alt={b.title} style={{ width:48, height:48, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>
                  : <div style={{ width:48, height:48, borderRadius:8, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Mi color="light">bookmark</Mi>
                    </div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.title||'제목 없음'}</div>
                  {b.description && <p style={{ fontSize:'0.78rem', color:'var(--color-text-light)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.description}</p>}
                  <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize:'0.72rem', color:'var(--color-primary)' }}>
                    <Mi size='sm'>link</Mi> 링크 열기
                  </a>
                </div>
              </div>
            ))
          }
          <Pagination total={filteredBookmarks.length} perPage={bookmarksPagination.perPage} page={bookmarksPagination.page} onPage={bookmarksPagination.setPage} onPerPage={bookmarksPagination.setPerPage}/>
        </div>
      )}

      {/* ── 방명록 ── */}
      {!tabLoading[activeTab] && activeTab==='guestbook' && <GuestbookPublicView ownerId={profile.id} postId={searchParams.get('post')}/>}

      {/* ── 문의/피드백 (관리자 페이지만) ── */}
      {!tabLoading[activeTab] && activeTab==='feedback' && profile?.is_admin && <FeedbackPublicView ownerId={profile.id} postId={searchParams.get('post')}/>}

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

      {/* 페어 히스토리 뷰 모달 (읽기 전용) */}
      <Modal isOpen={!!pubHistoryViewPair} onClose={()=>setPubHistoryViewPair(null)} title={`${pubHistoryViewPair?.name || ''} 히스토리`}
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setPubHistoryViewPair(null)}>닫기</button>}
      >
        <input className="form-input" placeholder="제목, 시스템, 날짜 검색..." value={pubHistoryViewSearch} onChange={e=>{setPubHistoryViewSearch(e.target.value);setPubHistoryViewPage(1)}} style={{marginBottom:10}}/>
        {pubHistoryViewPair && pairHistoriesMap[pubHistoryViewPair.id]===undefined
          ?<div className="text-xs text-light" style={{textAlign:'center',padding:'16px 0'}}>로딩 중...</div>
          :pubHistoryViewLogs.length===0
            ?<div className="text-xs text-light" style={{textAlign:'center',padding:'16px 0'}}>연결된 기록이 없어요.</div>
            :<div style={{display:'flex',flexDirection:'column',gap:4}}>
              {phvPaged.map(h=>(
                <div key={h.history_id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--color-border)'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.85rem',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.title||'(제목 없음)'}</div>
                    <div className="text-xs text-light">{h.played_date||''}{h.system_name?` · ${h.system_name}`:''}{h.role?` · ${h.role}`:''}</div>
                  </div>
                </div>
              ))}
              {phvTotalPages>1&&(
                <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:8}}>
                  <button className="btn btn-ghost btn-sm" disabled={pubHistoryViewPage===1} onClick={()=>setPubHistoryViewPage(p=>p-1)}>‹</button>
                  <span className="text-xs text-light">{pubHistoryViewPage} / {phvTotalPages}</span>
                  <button className="btn btn-ghost btn-sm" disabled={pubHistoryViewPage===phvTotalPages} onClick={()=>setPubHistoryViewPage(p=>p+1)}>›</button>
                </div>
              )}
            </div>
        }
      </Modal>

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
