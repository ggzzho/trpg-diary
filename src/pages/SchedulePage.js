// src/pages/SchedulePage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { schedulesApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { RuleSelect } from '../components/RuleSelect'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday, addMonths, subMonths, getYear, getMonth } from 'date-fns'
import { ko } from 'date-fns/locale'

const STATUS_MAP = {
  planned:{label:'예정',badge:'badge-blue'},
  completed:{label:'완료',badge:'badge-gray'}, cancelled:{label:'취소',badge:'badge-red'},
}
const BLANK = { title:'', scheduled_date:'', scheduled_time:'', end_time:'', location:'', system_name:'', description:'', status:'planned', is_gm:false, is_intro:false, intro_rule:'', entry_type:'session' }
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

export default function SchedulePage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [blockedItems, setBlockedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [blockedModal, setBlockedModal] = useState(false)
  const [editingBlocked, setEditingBlocked] = useState(null)
  const [blockedForm, setBlockedForm] = useState(BLOCKED_BLANK)
  const [blockedConfirm, setBlockedConfirm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [mainTab, setMainTab] = useState('session')
  const [viewMode, setViewMode] = useState('list')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [yearView, setYearView] = useState(new Date().getFullYear())
  const [summaryPeriod, setSummaryPeriod] = useState('month')
  const [summaryDate, setSummaryDate] = useState(new Date())
  const [copyModal, setCopyModal] = useState(false)
  const [copyTarget, setCopyTarget] = useState(null)
  const [copyMode, setCopyMode] = useState('copy')
  const [copyDate, setCopyDate] = useState('')
  const [search, setSearch] = useState('')

  const load = async () => {
    const {data} = await schedulesApi.getAll(user.id)
    const all = data || []
    setItems(all.filter(i => i.entry_type !== 'blocked'))
    setBlockedItems(all.filter(i => i.entry_type === 'blocked'))
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const setB = k => e => setBlockedForm(f=>({...f,[k]:e.target.value}))
  const openNewBlocked = () => { setEditingBlocked(null); setBlockedForm({...BLOCKED_BLANK, scheduled_date:new Date().toISOString().split('T')[0]}); setBlockedModal(true) }
  const openEditBlocked = item => { setEditingBlocked(item); setBlockedForm({...item}); setBlockedModal(true) }
  const saveBlocked = async () => {
    if (!blockedForm.scheduled_date) return
    const payload = { ...blockedForm, title:'', entry_type:'blocked', blocked_from:blockedForm.blocked_from||null, blocked_until:blockedForm.blocked_until||null }
    let error
    if (editingBlocked) {
      const res = await schedulesApi.update(editingBlocked.id, payload)
      error = res.error
    } else {
      const res = await schedulesApi.create({...payload, user_id:user.id})
      error = res.error
    }
    if (error) { alert('저장 실패: ' + error.message); return }
    setBlockedModal(false); load()
  }
  const removeBlocked = async id => { await schedulesApi.remove(id); load() }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = date => { setEditing(null); setForm({...BLANK,scheduled_date:date||new Date().toISOString().split('T')[0]}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const openCopy = (item,e) => { e?.stopPropagation(); setCopyTarget(item); setCopyDate(item.scheduled_date); setCopyMode('copy'); setCopyModal(true) }

  const save = async () => {
    if (!form.title||!form.scheduled_date) return
    const payload = {...form, scheduled_time:form.scheduled_time||null, end_time:form.end_time||null}
    if (editing) await schedulesApi.update(editing.id, payload)
    else await schedulesApi.create({...payload,user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await schedulesApi.remove(id); load() }
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
  }).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date))

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
        const di=items.filter(x=>x.scheduled_date===dateStr)
        const bl=blockedItems.filter(x=>x.scheduled_date===dateStr)
        week.push(
          <div key={dateStr} className={`calendar-cell ${isToday(d)?'today':''} ${!isSameMonth(d,calendarDate)?'other-month':''}`}
            style={{position:'relative', outline: bl.length>0 ? '2px solid #e57373' : 'none', outlineOffset:'-2px'}}
            onClick={()=>openNew(dateStr)}>
            <div className="calendar-date">{format(d,'d')}</div>
            {di.slice(0,2).map(ev=>(
              <div key={ev.id}
                className={`calendar-event ${ev.is_gm?'gm':''} ${ev.status==='cancelled'?'cancelled':''} ${ev.status==='completed'?'completed':''}`}
                onClick={e=>{e.stopPropagation();openEdit(ev)}} title={ev.title}
              >
                {fmtTime(ev.scheduled_time)&&<span style={{opacity:0.85,marginRight:2}}>{fmtTime(ev.scheduled_time)}</span>}
                {ev.title}
              </div>
            ))}
            {di.length>2&&<div style={{fontSize:'0.55rem',color:'var(--color-text-light)',paddingLeft:2}}>+{di.length-2}개 더</div>}
            {/* 불가 날짜 표시 */}
            {bl.map((b,i)=>(
              <div key={`bl${i}`}
                style={{fontSize:'0.58rem',padding:'1px 3px',borderRadius:3,marginBottom:2,background:'rgba(229,115,115,0.15)',color:'#e57373',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'default'}}
                onClick={e=>e.stopPropagation()}
                title={[b.blocked_from&&b.blocked_until?`${fmtTime(b.blocked_from)}~${fmtTime(b.blocked_until)}`:b.blocked_from?`${fmtTime(b.blocked_from)}~`:'', b.description].filter(Boolean).join(' ')}
              >
                🚫 {b.blocked_from?`${fmtTime(b.blocked_from)}${b.blocked_until?`~${fmtTime(b.blocked_until)}`:'~'}`:'종일'}
              </div>
            ))}
            {/* 복사/이동 버튼 */}
            {di.length>0&&(
              <div style={{position:'absolute',top:2,right:2}} onClick={e=>e.stopPropagation()}>
                <button
                  style={{fontSize:'0.58rem',background:'rgba(255,255,255,0.8)',border:'none',cursor:'pointer',padding:'1px 3px',borderRadius:3,lineHeight:1}}
                  title="복사/이동"
                  onClick={e=>openCopy(di[0],e)}
                ><Mi size='sm'>content_copy</Mi></button>
              </div>
            )}
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
    const yearItems=items.filter(i=>{
      if(filter==='upcoming') return i.scheduled_date>=today&&i.status!=='cancelled'&&i.status!=='completed'
      if(filter==='completed') return i.status==='completed'
      if(filter==='cancelled') return i.status==='cancelled'
      return true
    })
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
                {/* 모든 일정 표시 (3개 제한 없앰) + 제목+시간 */}
                {mi.map(i=>(
                  <div key={i.id} style={{fontSize:'0.6rem',padding:'2px 5px',borderRadius:3,marginBottom:2,background:i.status==='cancelled'?'#e57373':i.is_gm?'var(--color-accent)':'var(--color-primary)',color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {fmtTime(i.scheduled_time)&&<span style={{opacity:0.85,marginRight:3}}>{fmtTime(i.scheduled_time)}</span>}
                    {i.status==='cancelled'?'[취소] ':''}{i.title}
                  </div>
                ))}
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
      <div style={{marginBottom:12}}>
        <input className="form-input" placeholder="🔍 제목, 룰, 장소로 검색..." value={search}
          onChange={e=>setSearch(e.target.value)} autoComplete="off" style={{maxWidth:320}}/>
      </div>
      <div className="flex justify-between items-center" style={{marginBottom:18,flexWrap:'wrap',gap:8}}>
        {viewMode!=='summary'&&(
          <div className="flex gap-8">
            {[
              {k:'upcoming',l:'예정'},
              {k:'completed',l:'완료'},
              {k:'cancelled',l:'취소'},
              {k:'all',l:'전체'}
            ].map(f=>(
              <button key={f.k} className={`btn btn-sm ${filter===f.k?'btn-primary':'btn-outline'}`} onClick={()=>setFilter(f.k)}>{f.l}</button>
            ))}
          </div>
        )}
        {viewMode==='summary'&&<div/>}
        <div className="flex gap-8">
          <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('list')}><Mi size='sm'>list</Mi> 리스트</button>
          <button className={`btn btn-sm ${viewMode==='calendar'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('calendar')}><Mi size='sm'>calendar_month</Mi> 월</button>
          <button className={`btn btn-sm ${viewMode==='year'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('year')}><Mi size='sm'>calendar_view_month</Mi> 연</button>
          <button className={`btn btn-sm ${viewMode==='summary'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('summary')}><Mi size='sm'>bar_chart</Mi> 결산</button>
        </div>
      </div>
      {viewMode==='calendar'&&<div className="card">{renderCalendar()}</div>}
      {viewMode==='year'&&renderYear()}
      {viewMode==='summary'&&renderSummary()}
      {viewMode==='list'&&(
        loading?<LoadingSpinner/>:filtered.length===0
          ?<EmptyState icon="calendar_month" title="일정이 없어요" action={<button className="btn btn-primary" onClick={()=>openNew()}>추가하기</button>}/>
          :<>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {pagedSchedule.map(item=>(
              <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                <DateBox dateStr={item.scheduled_date}/>
                <div style={{flex:1,minWidth:0}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.title}</span>
                    <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`} style={{flexShrink:0}}>{STATUS_MAP[item.status]?.label}</span>
                    {item.is_gm&&<span className="badge badge-primary" style={{flexShrink:0}}>GM</span>}
                    {item.is_intro&&<span className="badge badge-green" style={{flexShrink:0}}>입문탁{item.intro_rule?` · ${item.intro_rule}`:''}</span>}
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {item.system_name&&<span><Mi size="sm" color="light">sports_esports</Mi> {item.system_name}{item.is_intro&&item.intro_rule?` (${item.intro_rule} 입문)`:''}</span>}
                    {item.scheduled_time&&<span>🕐 {fmtTime(item.scheduled_time)}{item.end_time?` ~ ${fmtTime(item.end_time)}`:''}</span>}
                    {item.location&&<span>🌐 {item.location}</span>}
                  </div>
                  {item.description&&<p className="text-sm text-light" style={{marginTop:4}}>{item.description}</p>}
                </div>
                <div className="flex gap-8" style={{flexShrink:0}}>
                  <button className="btn btn-ghost btn-sm" title="복사/이동" onClick={e=>openCopy(item,e)}><Mi size='sm'>content_copy</Mi></button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
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
                    <span style={{color:'#e57373',fontWeight:700,fontSize:'0.82rem'}}>🚫 세션 불가</span>
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
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEditBlocked(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setBlockedConfirm(item.id)}>삭제</button>
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
        <div className="form-group"><label className="form-label">메모 (사유 등)</label><input className="form-input" placeholder="예: 시험, 출장, 개인 사정..." value={blockedForm.description||''} onChange={setB('description')} autoComplete="off"/></div>
      </Modal>
      <ConfirmDialog isOpen={!!blockedConfirm} onClose={()=>setBlockedConfirm(null)} onConfirm={()=>removeBlocked(blockedConfirm)} message="이 불가 날짜를 삭제하시겠어요?"/>
    </div>
  )
}
