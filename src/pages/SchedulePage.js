// src/pages/SchedulePage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { schedulesApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { RuleSelect } from '../components/RuleSelect'
import { useRules } from '../context/RuleContext'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday, addMonths, subMonths, getYear, getMonth } from 'date-fns'
import { ko } from 'date-fns/locale'

const STATUS_MAP = {
  planned:{label:'예정',badge:'badge-blue'},
  completed:{label:'완료',badge:'badge-gray'}, cancelled:{label:'취소',badge:'badge-red'},
}
const BLANK = { title:'', scheduled_date:'', scheduled_time:'', end_time:'', location:'', system_name:'', description:'', status:'planned', is_gm:false, is_intro:false, intro_rule:'', entry_type:'session', series_id:null }
const BLOCKED_BLANK = { scheduled_date:'', blocked_from:'', blocked_until:'', description:'', entry_type:'blocked' }
const fmtTime = t => t ? t.slice(0,5) : ''

function DateBox({ dateStr }) {
  return (
    <div style={{background:'var(--color-primary)',borderRadius:8,padding:'8px 12px',textAlign:'center',minWidth:50,flexShrink:0,boxShadow:'0 2px 8px var(--color-btn-shadow)'}}>
      <div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.8)'}}>{format(new Date(dateStr),'M월',{locale:ko})}</div>
      <div style={{fontSize:'1.3rem',color:'white',fontWeight:700,lineHeight:1}}>{format(new Date(dateStr),'d')}</div>
      <div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.8)'}}>{format(new Date(dateStr),'EEE',{locale:ko})}</div>
    </div>
  )
}

// hex → rgba 변환 헬퍼
const hexToRgba = (hex, alpha) => {
  const h = hex.replace('#','')
  const r = parseInt(h.slice(0,2),16)
  const g = parseInt(h.slice(2,4),16)
  const b = parseInt(h.slice(4,6),16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function SchedulePage() {
  const { user } = useAuth()
  const { colorMap } = useRules()
  const [items, setItems] = useState([])
  const [blockedItems, setBlockedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [blockedModal, setBlockedModal] = useState(false)
  const [editingBlocked, setEditingBlocked] = useState(null)
  const [blockedForm, setBlockedForm] = useState(BLOCKED_BLANK)
  const [blockedConfirm, setBlockedConfirm] = useState(null)
  const [blockedSeriesConfirm, setBlockedSeriesConfirm] = useState(null)
  // 불가 날짜 전용 반복 state (세션 반복 state와 완전 분리)
  const [isRepeatBlocked, setIsRepeatBlocked] = useState(false)
  const [repeatModeBlocked, setRepeatModeBlocked] = useState('count')
  const [repeatCountBlocked, setRepeatCountBlocked] = useState(4)
  const [repeatEndDateBlocked, setRepeatEndDateBlocked] = useState('')
  const [repeatPreviewBlocked, setRepeatPreviewBlocked] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [mainTab, setMainTab] = useState('session')
  const [viewMode, setViewMode] = useState('calendar')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [yearView, setYearView] = useState(new Date().getFullYear())
  const [summaryPeriod, setSummaryPeriod] = useState('month')
  const [summaryDate, setSummaryDate] = useState(new Date())
  const [copyModal, setCopyModal] = useState(false)
  const [copyTarget, setCopyTarget] = useState(null)
  const [copyMode, setCopyMode] = useState('copy')
  const [copyDate, setCopyDate] = useState('')
  const [search, setSearch] = useState('')
  const [calPopup, setCalPopup] = useState(null) // 월뷰 상세 팝업
  const [selectedDate, setSelectedDate] = useState(null) // 월뷰 날짜 선택 패널
  const [seriesConfirm, setSeriesConfirm] = useState(null) // 시리즈 삭제 확인
  // 반복 일정 폼 state
  const [isRepeat, setIsRepeat] = useState(false)
  const [repeatMode, setRepeatMode] = useState('count') // 'count' | 'date'
  const [repeatCount, setRepeatCount] = useState(4)
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [repeatPreview, setRepeatPreview] = useState([])

  const load = async () => {
    const {data} = await schedulesApi.getAll(user.id)
    const all = data || []
    setItems(all.filter(i => i.entry_type !== 'blocked'))
    setBlockedItems(all.filter(i => i.entry_type === 'blocked'))
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  // 반복 미리보기 자동 계산
  useEffect(() => {
    if (!isRepeat || !form.scheduled_date) { setRepeatPreview([]); return }
    const dates = calcRepeatDates(form.scheduled_date, repeatMode, repeatCount, repeatEndDate)
    setRepeatPreview(dates)
  }, [isRepeat, form.scheduled_date, repeatMode, repeatCount, repeatEndDate])

  // 불가 날짜 반복 미리보기 자동 계산 (세션과 완전 독립)
  useEffect(() => {
    if (!isRepeatBlocked || !blockedForm.scheduled_date) { setRepeatPreviewBlocked([]); return }
    const dates = calcRepeatDates(blockedForm.scheduled_date, repeatModeBlocked, repeatCountBlocked, repeatEndDateBlocked)
    setRepeatPreviewBlocked(dates)
  }, [isRepeatBlocked, blockedForm.scheduled_date, repeatModeBlocked, repeatCountBlocked, repeatEndDateBlocked])

  const setB = k => e => setBlockedForm(f=>({...f,[k]:e.target.value}))
  const resetRepeatBlocked = () => { setIsRepeatBlocked(false); setRepeatModeBlocked('count'); setRepeatCountBlocked(4); setRepeatEndDateBlocked(''); setRepeatPreviewBlocked([]) }
  const openNewBlocked = () => { setEditingBlocked(null); setBlockedForm({...BLOCKED_BLANK, scheduled_date:new Date().toISOString().split('T')[0]}); resetRepeatBlocked(); setBlockedModal(true) }
  const openEditBlocked = item => { setEditingBlocked(item); setBlockedForm({...item}); resetRepeatBlocked(); setBlockedModal(true) }
  const saveBlocked = async () => {
    if (!blockedForm.scheduled_date) return
    const { id, user_id, created_at, ...blockedFields } = blockedForm
    const payload = { ...blockedFields, title:'', entry_type:'blocked', blocked_from:blockedForm.blocked_from||null, blocked_until:blockedForm.blocked_until||null }
    let error
    if (editingBlocked) {
      const res = await schedulesApi.update(editingBlocked.id, payload)
      error = res.error
    } else if (isRepeatBlocked && repeatPreviewBlocked.length > 1) {
      const seriesId = crypto.randomUUID()
      const inserts = repeatPreviewBlocked.map(date => ({
        ...payload, user_id: user.id, scheduled_date: date, series_id: seriesId
      }))
      const { error: e } = await supabase.from('schedules').insert(inserts)
      error = e
    } else {
      const res = await schedulesApi.create({...payload, user_id:user.id})
      error = res.error
    }
    if (error) { alert('저장 실패: ' + error.message); return }
    setBlockedModal(false); load()
  }
  const removeBlocked = async id => { await schedulesApi.remove(id); load() }
  const removeBlockedSeries = async seriesId => {
    await supabase.from('schedules').delete().eq('series_id', seriesId).eq('user_id', user.id)
    load()
  }
  const handleRemoveBlocked = (item) => {
    if (item.series_id) setBlockedSeriesConfirm(item)
    else setBlockedConfirm(item.id)
  }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const resetRepeat = () => { setIsRepeat(false); setRepeatMode('count'); setRepeatCount(4); setRepeatEndDate(''); setRepeatPreview([]) }
  const openNew = date => { setEditing(null); setForm({...BLANK,scheduled_date:date||new Date().toISOString().split('T')[0]}); resetRepeat(); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); resetRepeat(); setModal(true) }

  const calcRepeatDates = (baseDate, mode, count, endDate) => {
    if (!baseDate) return []
    const base = new Date(baseDate + 'T00:00:00')
    const dates = []
    if (mode === 'count') {
      for (let i = 0; i < Math.min(count, 52); i++) {
        const d = new Date(base)
        d.setDate(d.getDate() + i * 7)
        dates.push(format(d, 'yyyy-MM-dd'))
      }
    } else {
      if (!endDate) return []
      let d = new Date(base)
      const end = new Date(endDate + 'T00:00:00')
      while (d <= end && dates.length < 52) {
        dates.push(format(d, 'yyyy-MM-dd'))
        d.setDate(d.getDate() + 7)
      }
    }
    return dates
  }
  const openCopy = (item,e) => { e?.stopPropagation(); setCopyTarget(item); setCopyDate(item.scheduled_date); setCopyMode('copy'); setCopyModal(true) }

  const save = async () => {
    if (!form.title||!form.scheduled_date) return
    const { id, user_id, created_at, ...formFields } = form
    const payload = {...formFields, scheduled_time:form.scheduled_time||null, end_time:form.end_time||null}
    let error
    if (editing) {
      ;({ error } = await schedulesApi.update(editing.id, payload))
    } else if (isRepeat && repeatPreview.length > 1) {
      // 반복 일정 일괄 등록
      const seriesId = crypto.randomUUID()
      const inserts = repeatPreview.map(date => ({
        ...payload, user_id: user.id, scheduled_date: date, series_id: seriesId
      }))
      const { error: e } = await supabase.from('schedules').insert(inserts)
      error = e
    } else {
      ;({ error } = await schedulesApi.create({...payload, user_id:user.id}))
    }
    if (error) { alert('저장 실패: ' + error.message); return }
    setModal(false); load()
  }
  const remove = async id => { await schedulesApi.remove(id); load() }
  const removeSeries = async seriesId => {
    await supabase.from('schedules').delete().eq('series_id', seriesId).eq('user_id', user.id)
    load()
  }
  const handleRemove = (item) => {
    if (item.series_id) {
      setSeriesConfirm(item)
    } else {
      setConfirm(item.id)
    }
  }
  const executeCopyMove = async () => {
    if (!copyDate||!copyTarget) return
    if (copyMode==='copy') {
      const {id,created_at,...rest}=copyTarget
      await schedulesApi.create({...rest,scheduled_date:copyDate,user_id:user.id})
    } else {
      await schedulesApi.update(copyTarget.id,{...copyTarget,scheduled_date:copyDate})
    }
    setCopyModal(false); setCopyTarget(null); setCopyDate(''); load()
  }

  const today = new Date().toISOString().split('T')[0]

  // 탭별 필터 - 예정: 완료 숨김
  const filtered = items.filter(i => {
    const matchTab = filter==='upcoming' ? (i.scheduled_date>=today && i.status!=='cancelled' && i.status!=='completed')
      : filter==='completed' ? i.status==='completed'
      : filter==='cancelled' ? i.status==='cancelled'
      : true
    const matchSearch = !search || i.title?.includes(search) || i.system_name?.includes(search) || i.location?.includes(search)
    return matchTab && matchSearch
  }).sort((a,b) => {
    const dateComp = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateComp !== 0) return dateComp
    return (a.scheduled_time||'').localeCompare(b.scheduled_time||'')
  })

  const { paged: pagedSchedule, page: schedulePage, setPage: setSchedulePage, perPage: schedulePerPage, setPerPage: setSchedulePerPage } = usePagination(filtered, 20)

  const summaryStats = useMemo(() => {
    let t=items.filter(i=>i.status==='completed'||i.scheduled_date<today)
    if (summaryPeriod==='month') {
      const y=getYear(summaryDate),m=getMonth(summaryDate)
      t=t.filter(i=>{const d=new Date(i.scheduled_date);return getYear(d)===y&&getMonth(d)===m})
    } else t=t.filter(i=>getYear(new Date(i.scheduled_date))===yearView)
    const total=t.length,gmCount=t.filter(i=>i.is_gm).length,plCount=total-gmCount
    const rc={}; t.forEach(i=>{if(i.system_name)rc[i.system_name]=(rc[i.system_name]||0)+1})
    return {total,gmCount,plCount,topRules:Object.entries(rc).sort((a,b)=>b[1]-a[1]).slice(0,5)}
  }, [items,summaryPeriod,summaryDate,yearView])

  const renderCalendar = () => {
    const startDate=startOfWeek(startOfMonth(calendarDate),{weekStartsOn:0})
    const endDate=endOfWeek(endOfMonth(calendarDate),{weekStartsOn:0})
    const rows=[]; let day=startDate
    while (day<=endDate) {
      const week=[]
      for (let i=0;i<7;i++) {
        const d=new Date(day), dateStr=format(d,'yyyy-MM-dd')
        const di=items.filter(x=>x.scheduled_date===dateStr).sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||''))
        const bl=blockedItems.filter(x=>x.scheduled_date===dateStr)
        week.push(
          <div key={dateStr} className={`calendar-cell ${isToday(d)?'today':''} ${!isSameMonth(d,calendarDate)?'other-month':''}`}
            style={{position:'relative', outline: bl.length>0 ? '2px solid #e57373' : 'none', outlineOffset:'-2px'}}
            onClick={()=>setSelectedDate(prev => prev===dateStr ? null : dateStr)}>
            <div className="calendar-date">{format(d,'d')}</div>
            {di.slice(0,2).map(ev=>{
              const evColor = colorMap?.[ev.system_name]
              const isPast = dateStr < today
              const colorStyle = evColor && ev.status !== 'cancelled' ? {
                background: isPast
                  ? hexToRgba(evColor, 0.3)
                  : ev.is_gm ? hexToRgba(evColor, 1.0) : hexToRgba(evColor, 0.7),
                color: isPast ? hexToRgba(evColor, 0.85) : 'white',
              } : {}
              return (
                <div key={ev.id}
                  className={`calendar-event ${evColor?'':''}${ev.is_gm&&!evColor?'gm':''} ${ev.status==='cancelled'?'cancelled':''} ${ev.status==='completed'&&!evColor?'completed':''}`}
                  style={colorStyle}
                  onClick={e=>{e.stopPropagation();setCalPopup(ev)}} title={ev.title}
                >
                  {ev.series_id && <span style={{marginRight:2}}>🔁</span>}
                  {fmtTime(ev.scheduled_time)&&<span style={{opacity:0.85,marginRight:2}}>{fmtTime(ev.scheduled_time)}</span>}
                  {ev.title}
                </div>
              )
            })}
            {di.length>2&&<div style={{fontSize:'0.55rem',color:'var(--color-text-light)',paddingLeft:2}}>+{di.length-2}개 더</div>}
            {/* 불가 날짜 표시 */}
            {bl.map((b,i)=>(
              <div key={`bl${i}`}
                style={{fontSize:'0.58rem',padding:'1px 3px',borderRadius:3,marginBottom:2,background:'rgba(229,115,115,0.15)',color:'#e57373',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer'}}
                onClick={e=>{e.stopPropagation();setCalPopup(b)}}
                title={[b.blocked_from&&b.blocked_until?`${fmtTime(b.blocked_from)}~${fmtTime(b.blocked_until)}`:b.blocked_from?`${fmtTime(b.blocked_from)}~`:'', b.description].filter(Boolean).join(' ')}
              >
                🚫 {b.blocked_from?`${fmtTime(b.blocked_from)}${b.blocked_until?`~${fmtTime(b.blocked_until)}`:'~'}`:'종일'}
              </div>
            ))}
          </div>
        )
        day=addDays(day,1)
      }
      rows.push(<React.Fragment key={day.toString()}>{week}</React.Fragment>)
    }
    return (
      <div>
        <div className="flex justify-between items-center" style={{marginBottom:14}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCalendarDate(subMonths(calendarDate,1))}>‹ 이전</button>
          <span style={{fontWeight:700,fontSize:'1rem',color:'var(--color-accent)'}}>{format(calendarDate,'yyyy년 M월',{locale:ko})}</span>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCalendarDate(addMonths(calendarDate,1))}>다음 ›</button>
        </div>
        <div className="calendar-grid" style={{marginBottom:3}}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(
            <div key={d} className="calendar-day-header" style={{color:i===0?'#e57373':i===6?'#6b8cba':'var(--color-text-light)'}}>{d}</div>
          ))}
        </div>
        <div className="calendar-grid">{rows}</div>
      </div>
    )
  }

  const renderYear = () => {
    const yearItems = items // 필터 없이 전체 데이터
    return (
      <div>
        <div className="flex justify-between items-center" style={{marginBottom:16}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setYearView(y=>y-1)}>‹ {yearView-1}년</button>
          <span style={{fontWeight:700,fontSize:'1rem',color:'var(--color-accent)'}}>{yearView}년</span>
          <button className="btn btn-ghost btn-sm" onClick={()=>setYearView(y=>y+1)}>{yearView+1}년 ›</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {Array.from({length:12},(_,m)=>{
            const mi=yearItems.filter(i=>{const d=new Date(i.scheduled_date);return getYear(d)===yearView&&getMonth(d)===m})
            return (
              <div key={m} className="card card-sm" style={{cursor:'pointer'}} onClick={()=>{setCalendarDate(new Date(yearView,m,1));setViewMode('calendar')}}>
                <div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--color-accent)',marginBottom:6}}>{m+1}월 <span className="text-xs text-light">({mi.length})</span></div>
                {mi.map(i=>{
                  const evColor = colorMap?.[i.system_name]
                  const isPast = i.scheduled_date < today
                  const bg = i.status==='cancelled'
                    ? '#e57373'
                    : evColor
                      ? isPast ? hexToRgba(evColor,0.3) : i.is_gm ? hexToRgba(evColor,1.0) : hexToRgba(evColor,0.7)
                      : i.is_gm ? 'var(--color-accent)' : 'var(--color-primary)'
                  const textColor = evColor && isPast ? hexToRgba(evColor,0.85) : 'white'
                  return (
                    <div key={i.id} style={{fontSize:'0.6rem',padding:'2px 5px',borderRadius:3,marginBottom:2,background:bg,color:textColor,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {fmtTime(i.scheduled_time)&&<span style={{opacity:0.85,marginRight:3}}>{fmtTime(i.scheduled_time)}</span>}
                      {i.status==='cancelled'?'[취소] ':''}{i.title}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderSummary = () => (
    <div>
      <div className="flex gap-8 items-center" style={{marginBottom:16,flexWrap:'wrap'}}>
        <div className="flex gap-8">
          <button className={`btn btn-sm ${summaryPeriod==='month'?'btn-primary':'btn-outline'}`} onClick={()=>setSummaryPeriod('month')}>월별</button>
          <button className={`btn btn-sm ${summaryPeriod==='year'?'btn-primary':'btn-outline'}`} onClick={()=>setSummaryPeriod('year')}>연별</button>
        </div>
        {summaryPeriod==='month'
          ?<div className="flex gap-8 items-center">
            <button className="btn btn-ghost btn-sm" onClick={()=>setSummaryDate(d=>subMonths(d,1))}>‹</button>
            <span style={{fontWeight:600,fontSize:'0.88rem'}}>{format(summaryDate,'yyyy년 M월',{locale:ko})}</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSummaryDate(d=>addMonths(d,1))}>›</button>
          </div>
          :<div className="flex gap-8 items-center">
            <button className="btn btn-ghost btn-sm" onClick={()=>setYearView(y=>y-1)}>‹</button>
            <span style={{fontWeight:600,fontSize:'0.88rem'}}>{yearView}년</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setYearView(y=>y+1)}>›</button>
          </div>
        }
      </div>
      <div className="grid-3" style={{marginBottom:16}}>
        {[{v:summaryStats.total,l:'총 세션'},{v:summaryStats.plCount,l:'PL 횟수'},{v:summaryStats.gmCount,l:'GM 횟수'}].map(s=>(
          <div key={s.l} className="card" style={{textAlign:'center'}}>
            <div style={{fontSize:'1.8rem',fontWeight:700,color:'var(--color-accent)'}}>{s.v}</div>
            <div className="text-sm text-light">{s.l}</div>
          </div>
        ))}
      </div>
      {summaryStats.topRules.length>0&&(
        <div className="card">
          <div style={{fontWeight:700,marginBottom:14,color:'var(--color-accent)'}}><Mi size="sm" style={{marginRight:5}}>sports_esports</Mi>룰별 횟수</div>
          {summaryStats.topRules.map(([rule,count])=>(
            <div key={rule} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:'0.88rem'}}>{rule}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{height:7,borderRadius:4,background:'var(--color-primary)',width:`${(count/summaryStats.total)*100}px`,minWidth:16}}/>
                <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-accent)',minWidth:24,textAlign:'right'}}>{count}회</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>calendar_month</Mi>일정 관리</h1><p className="page-subtitle">예정된 세션과 지나간 플레이 일정을 관리해요</p></div>
        <div className="flex gap-8">
          {mainTab==='session'
            ? <button className="btn btn-primary" onClick={()=>openNew()}><Mi size='sm' color='white'>add</Mi> 일정 추가</button>
            : <button className="btn btn-primary" style={{background:'#e57373',borderColor:'#e57373'}} onClick={openNewBlocked}><Mi size='sm' color='white'>block</Mi> 불가 날짜 추가</button>
          }
        </div>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-8" style={{marginBottom:16}}>
        <button className={`btn btn-sm ${mainTab==='session'?'btn-primary':'btn-outline'}`} onClick={()=>setMainTab('session')}>
          <Mi size='sm' color={mainTab==='session'?'white':'accent'}>calendar_month</Mi> 세션 일정
        </button>
        <button className={`btn btn-sm ${mainTab==='blocked'?'btn-primary':'btn-outline'}`}
          style={mainTab==='blocked'?{background:'#e57373',borderColor:'#e57373'}:{}}
          onClick={()=>setMainTab('blocked')}>
          <Mi size='sm' color={mainTab==='blocked'?'white':'accent'}>block</Mi> 불가 날짜 {blockedItems.length>0&&`(${blockedItems.length})`}
        </button>
      </div>

      {/* ── 세션 일정 탭 ── */}
      {mainTab==='session' && (<>
      <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
        <input className="form-input" placeholder="🔍 제목, 룰, 장소로 검색..." value={search}
          onChange={e=>setSearch(e.target.value)} autoComplete="off" style={{maxWidth:320}}/>
        {search && <span className="text-xs text-light">({filtered.length}건)</span>}
      </div>
      <div className="flex justify-end items-center" style={{marginBottom:18,flexWrap:'wrap',gap:8}}>
        <div className="flex gap-8">
          <button className={`btn btn-sm ${viewMode==='calendar'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('calendar')}><Mi size='sm'>calendar_month</Mi> 월</button>
          <button className={`btn btn-sm ${viewMode==='year'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('year')}><Mi size='sm'>calendar_view_month</Mi> 연</button>
          <button className={`btn btn-sm ${viewMode==='summary'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('summary')}><Mi size='sm'>bar_chart</Mi> 결산</button>
        </div>
      </div>
      {viewMode==='calendar'&&(
        <div style={{display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{flex:'1 1 320px',minWidth:0}}>
            <div className="card">{renderCalendar()}</div>
          </div>
          {selectedDate&&(
            <div style={{flex:'0 0 260px',minWidth:0}}>
              <div className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <span style={{fontWeight:700,fontSize:'0.9rem',color:'var(--color-accent)'}}>
                    {format(new Date(selectedDate+'T00:00:00'),'M월 d일 (EEE)',{locale:ko})}
                  </span>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>openNew(selectedDate)} title="일정 추가">
                      <Mi size='sm' color='white'>add</Mi>
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedDate(null)}>
                      <Mi size='sm'>close</Mi>
                    </button>
                  </div>
                </div>
                {(()=>{
                  const dayItems=items.filter(x=>x.scheduled_date===selectedDate).sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||''))
                  const dayBlocked=blockedItems.filter(x=>x.scheduled_date===selectedDate)
                  if(dayItems.length===0&&dayBlocked.length===0) return <p className="text-sm text-light" style={{textAlign:'center',padding:'12px 0'}}>일정이 없어요</p>
                  return <>
                    {dayItems.map(item=>(
                      <div key={item.id} style={{padding:'8px 0',borderBottom:'1px solid var(--color-border)'}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:'0.82rem',marginBottom:4}}>{item.title}</div>
                            <div className="text-xs text-light" style={{display:'flex',flexWrap:'wrap',gap:'2px 8px'}}>
                              {(item.scheduled_time||item.end_time)&&(
                                <span>🕐 {fmtTime(item.scheduled_time)}{item.end_time?` ~ ${fmtTime(item.end_time)}`:''}</span>
                              )}
                              {item.system_name&&<span><Mi size="sm" color="light">sports_esports</Mi> {item.system_name}</span>}
                            </div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                              <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`}>{STATUS_MAP[item.status]?.label}</span>
                              {item.is_gm
                                ? <span className="badge badge-primary">GM</span>
                                : <span className="badge badge-blue" style={{opacity:0.8}}>PL</span>
                              }
                              {item.is_intro&&<span className="badge badge-green">입문탁{item.intro_rule?` · ${item.intro_rule}`:''}</span>}
                            </div>
                          </div>
                          <div style={{display:'flex',gap:4,flexShrink:0}}>
                            <button className="btn btn-ghost btn-sm" title="복사/이동" onClick={e=>openCopy(item,e)}><Mi size='sm'>content_copy</Mi></button>
                            <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}><Mi size='sm'>edit</Mi></button>
                            <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>handleRemove(item)}><Mi size='sm'>delete</Mi></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {dayBlocked.map(item=>(
                      <div key={item.id} style={{padding:'8px 0',borderBottom:'1px solid var(--color-border)',display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:'0.82rem',color:'#e57373',marginBottom:2}}>
                            🚫 {item.blocked_from?`${fmtTime(item.blocked_from)}${item.blocked_until?`~${fmtTime(item.blocked_until)}`:'~'}`:'종일 불가'}
                          </div>
                          {item.description&&<div className="text-xs text-light">{item.description}</div>}
                        </div>
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          <button className="btn btn-ghost btn-sm" onClick={e=>openCopy(item,e)}><Mi size='sm'>content_copy</Mi></button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>openEditBlocked(item)}><Mi size='sm'>edit</Mi></button>
                          <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>handleRemoveBlocked(item)}><Mi size='sm'>delete</Mi></button>
                        </div>
                      </div>
                    ))}
                  </>
                })()}
              </div>
            </div>
          )}
        </div>
      )}
      {viewMode==='year'&&renderYear()}
      {viewMode==='summary'&&renderSummary()}
      {viewMode==='list'&&(
        loading?<LoadingSpinner/>:filtered.length===0
          ?<EmptyState icon="calendar_month" title="일정이 없어요" action={<button className="btn btn-primary" onClick={()=>openNew()}>추가하기</button>}/>
          :<>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {pagedSchedule.map(item=>(
              <div key={item.id} className="card card-sm">
                <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                  <DateBox dateStr={item.scheduled_date}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}>
                      {item.series_id && <span title="반복 일정">🔁</span>}
                      <span style={{fontWeight:600,fontSize:'0.88rem'}}>{item.title}</span>
                      <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`} style={{flexShrink:0}}>{STATUS_MAP[item.status]?.label}</span>
                      {item.is_gm&&<span className="badge badge-primary" style={{flexShrink:0}}>GM</span>}
                      {item.is_intro&&<span className="badge badge-green" style={{flexShrink:0}}>입문탁{item.intro_rule?` · ${item.intro_rule}`:''}</span>}
                    </div>
                    <div className="text-xs text-light" style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                      {item.system_name&&<span><Mi size="sm" color="light">sports_esports</Mi> {item.system_name}</span>}
                      {item.scheduled_time&&<span>🕐 {fmtTime(item.scheduled_time)}{item.end_time?` ~ ${fmtTime(item.end_time)}`:''}</span>}
                      {item.location&&<span>🌐 {item.location}</span>}
                    </div>
                    {item.description&&<p className="text-sm text-light" style={{marginTop:4}}>{item.description}</p>}
                  </div>
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" title="복사/이동" onClick={e=>openCopy(item,e)}><Mi size='sm'>content_copy</Mi></button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>handleRemove(item)}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
            </div>
            <Pagination total={filtered.length} perPage={schedulePerPage} page={schedulePage} onPage={setSchedulePage} onPerPage={setSchedulePerPage}/>
          </>
      )}
      </>)}

      {/* ── 불가 날짜 탭 ── */}
      {mainTab==='blocked' && (
        loading?<LoadingSpinner/>:blockedItems.length===0
          ?<EmptyState icon="block" title="등록된 불가 날짜가 없어요" action={<button className="btn btn-primary" style={{background:'#e57373',borderColor:'#e57373'}} onClick={openNewBlocked}>추가하기</button>}/>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[...blockedItems].sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)).map(item=>(
              <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14,borderLeft:'3px solid #e57373'}}>
                <DateBox dateStr={item.scheduled_date}/>
                <div style={{flex:1,minWidth:0}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{color:'#e57373',fontWeight:700,fontSize:'0.82rem'}}>
                      🚫 세션 불가{item.series_id && ' 🔁'}
                    </span>
                    {item.blocked_from&&(
                      <span className="badge badge-red" style={{fontSize:'0.68rem'}}>
                        {fmtTime(item.blocked_from)}{item.blocked_until?` ~ ${fmtTime(item.blocked_until)}`:' ~'}
                      </span>
                    )}
                    {!item.blocked_from&&<span className="badge badge-red" style={{fontSize:'0.68rem'}}>종일</span>}
                  </div>
                  {item.description&&<p className="text-sm text-light">{item.description}</p>}
                </div>
                <div className="flex gap-8" style={{flexShrink:0}}>
                  <button className="btn btn-ghost btn-sm" title="복사/이동" onClick={e=>openCopy(item,e)}><Mi size='sm'>content_copy</Mi></button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEditBlocked(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>handleRemoveBlocked(item)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
      )}

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'일정 수정':'새 일정 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" value={form.title} onChange={set('title')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">날짜 *</label><input className="form-input" type="date" value={form.scheduled_date} onChange={set('scheduled_date')}/></div>
          <div className="form-group"><label className="form-label">시작 시간</label><input className="form-input" type="time" value={form.scheduled_time||''} onChange={set('scheduled_time')}/></div>
          <div className="form-group"><label className="form-label">종료 시간</label><input className="form-input" type="time" value={form.end_time||''} onChange={set('end_time')}/></div>
        </div>

        {/* 반복 일정 - 새 일정 등록 시에만 표시 */}
        {!editing && (
          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',userSelect:'none',marginBottom:8}}>
              <input type="checkbox" checked={isRepeat} onChange={e=>{setIsRepeat(e.target.checked)}}
                style={{width:16,height:16,accentColor:'var(--color-primary)',cursor:'pointer'}}/>
              <span style={{fontSize:'0.88rem',fontWeight:600}}>🔁 반복 일정</span>
            </label>
            {isRepeat && (
              <div style={{padding:'12px 14px',borderRadius:8,background:'var(--color-nav-active-bg)',border:'1px solid var(--color-border)'}}>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <button className={`btn btn-sm ${repeatMode==='count'?'btn-primary':'btn-outline'}`}
                    onClick={()=>setRepeatMode('count')}>횟수로 설정</button>
                  <button className={`btn btn-sm ${repeatMode==='date'?'btn-primary':'btn-outline'}`}
                    onClick={()=>setRepeatMode('date')}>종료 날짜로 설정</button>
                </div>
                {repeatMode==='count' ? (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input className="form-input" type="number" min="2" max="52"
                      value={repeatCount} onChange={e=>setRepeatCount(Number(e.target.value))}
                      style={{width:80}}/>
                    <span style={{fontSize:'0.85rem',color:'var(--color-text-light)'}}>주 반복 (첫 날 포함)</span>
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input className="form-input" type="date" value={repeatEndDate}
                      onChange={e=>setRepeatEndDate(e.target.value)} style={{flex:1}}/>
                    <span style={{fontSize:'0.85rem',color:'var(--color-text-light)'}}>까지</span>
                  </div>
                )}
                {repeatPreview.length > 0 && (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:'0.78rem',color:'var(--color-text-light)',marginBottom:6}}>
                      📅 총 {repeatPreview.length}개 등록 예정
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {repeatPreview.map(d=>(
                        <span key={d} style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:100,
                          background:'var(--color-surface)',border:'1px solid var(--color-border)'}}>
                          {format(new Date(d+'T00:00:00'),'M/d(EEE)',{locale:ko})}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
          <div className="form-group"><label className="form-label">사이트</label><input className="form-input" placeholder="roll20, 코코포리아..." value={form.location||''} onChange={set('location')}/></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">상태</label>
            <select className="form-select" value={form.status} onChange={set('status')}>
              <option value="planned">예정</option><option value="completed">완료</option><option value="cancelled">취소</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">역할</label>
            <select className="form-select" value={form.is_gm?'gm':'pl'} onChange={e=>setForm(f=>({...f,is_gm:e.target.value==='gm'}))}>
              <option value="pl">PL</option><option value="gm">GM</option>
            </select>
          </div>
        </div>
        {/* 입문탁 */}
        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',userSelect:'none'}}>
            <input type="checkbox" checked={!!form.is_intro}
              onChange={e=>setForm(f=>({...f,is_intro:e.target.checked,intro_rule:e.target.checked?f.intro_rule:''}))}
              style={{width:16,height:16,accentColor:'var(--color-primary)',cursor:'pointer'}}/>
            <span style={{fontSize:'0.88rem',fontWeight:600}}>입문탁</span>
          </label>
          {form.is_intro&&(
            <input className="form-input" placeholder="어떤 룰의 입문인지 입력 (예: CoC, 인세인...)"
              value={form.intro_rule||''} onChange={set('intro_rule')}
              style={{marginTop:8}} autoComplete="off"/>
          )}
        </div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.description||''} onChange={set('description')} style={{minHeight:72}}/></div>
      </Modal>

      <Modal isOpen={copyModal} onClose={()=>setCopyModal(false)} title="일정 복사 / 이동"
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setCopyModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={executeCopyMove}>{copyMode==='copy'?'복사하기':'이동하기'}</button></>}
      >
        <div style={{marginBottom:14,padding:12,borderRadius:8,background:'var(--color-nav-active-bg)'}}>
          <div style={{fontWeight:600,fontSize:'0.88rem',marginBottom:4}}>{copyTarget?.title}</div>
          <div className="text-xs text-light">{copyTarget?.scheduled_date}</div>
        </div>
        <div className="flex gap-8" style={{marginBottom:16}}>
          <button className={`btn btn-sm ${copyMode==='copy'?'btn-primary':'btn-outline'}`} onClick={()=>setCopyMode('copy')}><Mi size='sm' color='white'>content_copy</Mi> 복사</button>
          <button className={`btn btn-sm ${copyMode==='move'?'btn-primary':'btn-outline'}`} onClick={()=>setCopyMode('move')}><Mi size='sm' color='white'>cut</Mi> 이동</button>
        </div>
        <div className="form-group">
          <label className="form-label">{copyMode==='copy'?'복사할 날짜':'이동할 날짜'}</label>
          <input className="form-input" type="date" value={copyDate} onChange={e=>setCopyDate(e.target.value)}/>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 일정을 삭제하시겠어요?"/>

      {/* 불가 날짜 모달 */}
      <Modal isOpen={blockedModal} onClose={()=>setBlockedModal(false)} title={editingBlocked?'불가 날짜 수정':'불가 날짜 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setBlockedModal(false)}>취소</button><button className="btn btn-primary btn-sm" style={{background:'#e57373',borderColor:'#e57373'}} onClick={saveBlocked}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">날짜 *</label><input className="form-input" type="date" value={blockedForm.scheduled_date} onChange={setB('scheduled_date')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">불가 시작 시간</label><input className="form-input" type="time" value={blockedForm.blocked_from||''} onChange={setB('blocked_from')}/></div>
          <div className="form-group"><label className="form-label">불가 종료 시간</label><input className="form-input" type="time" value={blockedForm.blocked_until||''} onChange={setB('blocked_until')}/></div>
        </div>
        <p className="text-xs text-light" style={{marginTop:-8,marginBottom:12}}>시간 미입력 시 종일 불가로 표시돼요</p>

        {/* 반복 설정 - 신규 등록 시에만 표시 */}
        {!editingBlocked && (
          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',userSelect:'none',marginBottom:8}}>
              <input type="checkbox" checked={isRepeatBlocked} onChange={e=>setIsRepeatBlocked(e.target.checked)}
                style={{width:16,height:16,accentColor:'#e57373',cursor:'pointer'}}/>
              <span style={{fontSize:'0.88rem',fontWeight:600}}>🔁 반복 불가 날짜</span>
            </label>
            {isRepeatBlocked && (
              <div style={{padding:'12px 14px',borderRadius:8,background:'rgba(229,115,115,0.06)',border:'1px solid rgba(229,115,115,0.2)'}}>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <button className={`btn btn-sm ${repeatModeBlocked==='count'?'btn-primary':'btn-outline'}`}
                    style={repeatModeBlocked==='count'?{background:'#e57373',borderColor:'#e57373'}:{}}
                    onClick={()=>setRepeatModeBlocked('count')}>횟수로 설정</button>
                  <button className={`btn btn-sm ${repeatModeBlocked==='date'?'btn-primary':'btn-outline'}`}
                    style={repeatModeBlocked==='date'?{background:'#e57373',borderColor:'#e57373'}:{}}
                    onClick={()=>setRepeatModeBlocked('date')}>종료 날짜로 설정</button>
                </div>
                {repeatModeBlocked==='count' ? (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input className="form-input" type="number" min="2" max="52"
                      value={repeatCountBlocked} onChange={e=>setRepeatCountBlocked(Number(e.target.value))}
                      style={{width:80}}/>
                    <span style={{fontSize:'0.85rem',color:'var(--color-text-light)'}}>주 반복 (첫 날 포함)</span>
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input className="form-input" type="date" value={repeatEndDateBlocked}
                      onChange={e=>setRepeatEndDateBlocked(e.target.value)} style={{flex:1}}/>
                    <span style={{fontSize:'0.85rem',color:'var(--color-text-light)'}}>까지</span>
                  </div>
                )}
                {repeatPreviewBlocked.length > 0 && (
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:'0.78rem',color:'var(--color-text-light)',marginBottom:6}}>
                      📅 총 {repeatPreviewBlocked.length}개 등록 예정
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {repeatPreviewBlocked.map(d=>(
                        <span key={d} style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:100,
                          background:'var(--color-surface)',border:'1px solid rgba(229,115,115,0.3)'}}>
                          {format(new Date(d+'T00:00:00'),'M/d(EEE)',{locale:ko})}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="form-group"><label className="form-label">메모 (사유 등)</label><input className="form-input" placeholder="예: 시험, 출장, 개인 사정..." value={blockedForm.description||''} onChange={setB('description')} autoComplete="off"/></div>
      </Modal>
      <ConfirmDialog isOpen={!!blockedConfirm} onClose={()=>setBlockedConfirm(null)} onConfirm={()=>removeBlocked(blockedConfirm)} message="이 불가 날짜를 삭제하시겠어요?"/>

      {/* 불가 날짜 시리즈 삭제 confirm */}
      {blockedSeriesConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:24,width:'100%',maxWidth:360,border:'1px solid var(--color-border)'}}>
            <h3 style={{fontWeight:700,marginBottom:8,fontSize:'0.95rem'}}>불가 날짜 삭제</h3>
            <p style={{fontSize:'0.85rem',color:'var(--color-text-light)',marginBottom:20,lineHeight:1.65}}>
              이 날짜는 반복 불가 날짜 시리즈예요.<br/>어떻게 삭제할까요?
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button className="btn btn-outline btn-sm" style={{justifyContent:'center'}}
                onClick={()=>{ removeBlocked(blockedSeriesConfirm.id); setBlockedSeriesConfirm(null) }}>
                이 날짜만 삭제
              </button>
              <button className="btn btn-sm" style={{background:'#e57373',borderColor:'#e57373',color:'white',justifyContent:'center'}}
                onClick={()=>{ removeBlockedSeries(blockedSeriesConfirm.series_id); setBlockedSeriesConfirm(null) }}>
                시리즈 전체 삭제
              </button>
              <button className="btn btn-ghost btn-sm" style={{justifyContent:'center'}}
                onClick={()=>setBlockedSeriesConfirm(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 월뷰 상세 팝업 */}
      {calPopup && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>e.target===e.currentTarget&&setCalPopup(null)}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:24,width:'100%',maxWidth:380,border:'1px solid var(--color-border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
              <div>
                {calPopup.entry_type==='blocked'
                  ? <><span style={{fontSize:'0.75rem',color:'#e57373',marginBottom:4,display:'block'}}>🚫 세션 불가{calPopup.series_id&&' 🔁'}</span>
                      <h3 style={{fontWeight:700,fontSize:'1rem',color:'#e57373'}}>
                        {calPopup.blocked_from?`${fmtTime(calPopup.blocked_from)}${calPopup.blocked_until?`~${fmtTime(calPopup.blocked_until)}`:'~'}`:'종일'}
                      </h3></>
                  : <>{calPopup.series_id&&<span style={{fontSize:'0.75rem',color:'var(--color-primary)',marginBottom:4,display:'block'}}>🔁 반복 일정</span>}
                      <h3 style={{fontWeight:700,fontSize:'1rem',color:'var(--color-accent)'}}>{calPopup.title}</h3></>
                }
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setCalPopup(null)}><Mi size="sm">close</Mi></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16,fontSize:'0.85rem',color:'var(--color-text-light)'}}>
              <div><Mi size="sm" color="light">calendar_month</Mi> {calPopup.scheduled_date}</div>
              {calPopup.entry_type==='blocked'
                ? <>{calPopup.description&&<p style={{lineHeight:1.65}}>{calPopup.description}</p>}</>
                : <>{calPopup.scheduled_time&&<div>🕐 {fmtTime(calPopup.scheduled_time)}{calPopup.end_time?` ~ ${fmtTime(calPopup.end_time)}`:''}</div>}
                    {calPopup.system_name&&<div><Mi size="sm" color="light">sports_esports</Mi> {calPopup.system_name}</div>}
                    {calPopup.location&&<div><Mi size="sm" color="light">place</Mi> {calPopup.location}</div>}
                    <div style={{display:'flex',gap:8}}>
                      <span className={`badge ${STATUS_MAP[calPopup.status]?.badge||'badge-gray'}`}>{STATUS_MAP[calPopup.status]?.label}</span>
                      {calPopup.is_gm&&<span className="badge badge-primary">GM</span>}
                      {calPopup.is_intro&&<span className="badge badge-green">입문탁</span>}
                    </div>
                    {calPopup.description&&<p style={{marginTop:4,lineHeight:1.65}}>{calPopup.description}</p>}
                  </>
              }
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:14,borderTop:'1px solid var(--color-border)'}}>
              {calPopup.entry_type==='blocked'
                ? <>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}}
                      onClick={()=>{ setCalPopup(null); handleRemoveBlocked(calPopup) }}>
                      <Mi size="sm" color="light">delete</Mi> 삭제
                    </button>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-outline btn-sm" onClick={()=>setCalPopup(null)}>닫기</button>
                      <button className="btn btn-outline btn-sm" onClick={()=>{ setCalPopup(null); openCopy(calPopup) }}>
                        <Mi size="sm">content_copy</Mi> 복사
                      </button>
                      <button className="btn btn-primary btn-sm" style={{background:'#e57373',borderColor:'#e57373'}}
                        onClick={()=>{ setCalPopup(null); openEditBlocked(calPopup) }}>
                        <Mi size="sm" color="white">edit</Mi> 수정
                      </button>
                    </div>
                  </>
                : <>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}}
                      onClick={()=>{ setCalPopup(null); handleRemove(calPopup) }}>
                      <Mi size="sm" color="light">delete</Mi> 삭제
                    </button>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-outline btn-sm" onClick={()=>setCalPopup(null)}>닫기</button>
                      <button className="btn btn-primary btn-sm"
                        onClick={()=>{ setCalPopup(null); openEdit(calPopup) }}>
                        <Mi size="sm" color="white">edit</Mi> 수정
                      </button>
                    </div>
                  </>
              }
            </div>
          </div>
        </div>
      )}

      {/* 시리즈 삭제 confirm */}
      {seriesConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:24,width:'100%',maxWidth:360,border:'1px solid var(--color-border)'}}>
            <h3 style={{fontWeight:700,marginBottom:8,fontSize:'0.95rem'}}>일정 삭제</h3>
            <p style={{fontSize:'0.85rem',color:'var(--color-text-light)',marginBottom:20,lineHeight:1.65}}>
              이 일정은 반복 일정 시리즈예요.<br/>어떻게 삭제할까요?
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button className="btn btn-outline btn-sm" style={{justifyContent:'center'}}
                onClick={()=>{ remove(seriesConfirm.id); setSeriesConfirm(null) }}>
                이 일정만 삭제
              </button>
              <button className="btn btn-sm" style={{background:'#e57373',borderColor:'#e57373',color:'white',justifyContent:'center'}}
                onClick={()=>{ removeSeries(seriesConfirm.series_id); setSeriesConfirm(null) }}>
                시리즈 전체 삭제
              </button>
              <button className="btn btn-ghost btn-sm" style={{justifyContent:'center'}}
                onClick={()=>setSeriesConfirm(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
