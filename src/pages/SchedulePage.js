// src/pages/SchedulePage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { schedulesApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday, addMonths, subMonths, getYear, getMonth } from 'date-fns'
import { ko } from 'date-fns/locale'

const STATUS_MAP = {
  planned:{label:'예정',badge:'badge-blue'}, confirmed:{label:'확정',badge:'badge-green'},
  completed:{label:'완료',badge:'badge-gray'}, cancelled:{label:'취소',badge:'badge-red'},
}
const BLANK = { title:'', scheduled_date:'', scheduled_time:'', location:'', system_name:'', description:'', status:'planned', is_gm:false }
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
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [viewMode, setViewMode] = useState('list')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [yearView, setYearView] = useState(new Date().getFullYear())
  const [ruleManager, setRuleManager] = useState(false)
  const [summaryPeriod, setSummaryPeriod] = useState('month')
  const [summaryDate, setSummaryDate] = useState(new Date())
  const [copyModal, setCopyModal] = useState(false)
  const [copyTarget, setCopyTarget] = useState(null)
  const [copyMode, setCopyMode] = useState('copy')
  const [copyDate, setCopyDate] = useState('')

  const load = async () => { const {data}=await schedulesApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = date => { setEditing(null); setForm({...BLANK,scheduled_date:date||new Date().toISOString().split('T')[0]}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const openCopy = (item,e) => { e?.stopPropagation(); setCopyTarget(item); setCopyDate(item.scheduled_date); setCopyMode('copy'); setCopyModal(true) }

  const save = async () => {
    if (!form.title||!form.scheduled_date) return
    const payload = {...form, scheduled_time:form.scheduled_time||null}
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
    if (filter==='upcoming') return i.scheduled_date>=today && i.status!=='cancelled' && i.status!=='completed'
    if (filter==='completed') return i.status==='completed'
    if (filter==='cancelled') return i.status==='cancelled'
    return true
  }).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date))

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
        week.push(
          <div key={dateStr} className={`calendar-cell ${isToday(d)?'today':''} ${!isSameMonth(d,calendarDate)?'other-month':''}`}
            style={{position:'relative'}} onClick={()=>openNew(dateStr)}>
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
            {/* 복사/이동 버튼 - 일정 있는 모든 날에 표시 */}
            {di.length>0&&(
              <div style={{position:'absolute',top:2,right:2}} onClick={e=>e.stopPropagation()}>
                <button
                  style={{fontSize:'0.58rem',background:'rgba(255,255,255,0.8)',border:'none',cursor:'pointer',padding:'1px 3px',borderRadius:3,lineHeight:1}}
                  title="복사/이동"
                  onClick={e=>openCopy(di[0],e)}
                >📋</button>
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
          <div style={{fontWeight:700,marginBottom:14,color:'var(--color-accent)'}}>🎲 룰별 횟수</div>
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
        <div><h1 className="page-title">📅 일정 관리</h1><p className="page-subtitle">예정된 세션과 지나간 플레이 일정을 관리해요</p></div>
        <button className="btn btn-primary" onClick={()=>openNew()}>+ 일정 추가</button>
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
          <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('list')}>≡ 리스트</button>
          <button className={`btn btn-sm ${viewMode==='calendar'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('calendar')}>📅 월</button>
          <button className={`btn btn-sm ${viewMode==='year'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('year')}>📆 연</button>
          <button className={`btn btn-sm ${viewMode==='summary'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('summary')}>📊 결산</button>
        </div>
      </div>
      {viewMode==='calendar'&&<div className="card">{renderCalendar()}</div>}
      {viewMode==='year'&&renderYear()}
      {viewMode==='summary'&&renderSummary()}
      {viewMode==='list'&&(
        loading?<LoadingSpinner/>:filtered.length===0
          ?<EmptyState icon="📅" title="일정이 없어요" action={<button className="btn btn-primary" onClick={()=>openNew()}>추가하기</button>}/>
          :<div style={{display:'flex',flexDirection:'column',gap:10}}>
            {filtered.map(item=>(
              <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                <DateBox dateStr={item.scheduled_date}/>
                <div style={{flex:1,minWidth:0}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.title}</span>
                    <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`} style={{flexShrink:0}}>{STATUS_MAP[item.status]?.label}</span>
                    {item.is_gm&&<span className="badge badge-primary" style={{flexShrink:0}}>GM</span>}
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {item.system_name&&<span>🎲 {item.system_name}</span>}
                    {item.scheduled_time&&<span>🕐 {fmtTime(item.scheduled_time)}</span>}
                    {item.location&&<span>🌐 {item.location}</span>}
                  </div>
                  {item.description&&<p className="text-sm text-light" style={{marginTop:4}}>{item.description}</p>}
                </div>
                <div className="flex gap-8" style={{flexShrink:0}}>
                  <button className="btn btn-ghost btn-sm" title="복사/이동" onClick={e=>openCopy(item,e)}>📋</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
      )}

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'일정 수정':'새 일정 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" value={form.title} onChange={set('title')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">날짜 *</label><input className="form-input" type="date" value={form.scheduled_date} onChange={set('scheduled_date')}/></div>
          <div className="form-group"><label className="form-label">시간</label><input className="form-input" type="time" value={form.scheduled_time||''} onChange={set('scheduled_time')}/></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
          <div className="form-group"><label className="form-label">사이트</label><input className="form-input" placeholder="roll20, 코코포리아..." value={form.location||''} onChange={set('location')}/></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">상태</label>
            <select className="form-select" value={form.status} onChange={set('status')}>
              <option value="planned">예정</option><option value="confirmed">확정</option><option value="completed">완료</option><option value="cancelled">취소</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">역할</label>
            <select className="form-select" value={form.is_gm?'gm':'pl'} onChange={e=>setForm(f=>({...f,is_gm:e.target.value==='gm'}))}>
              <option value="pl">PL</option><option value="gm">GM</option>
            </select>
          </div>
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
          <button className={`btn btn-sm ${copyMode==='copy'?'btn-primary':'btn-outline'}`} onClick={()=>setCopyMode('copy')}>📋 복사</button>
          <button className={`btn btn-sm ${copyMode==='move'?'btn-primary':'btn-outline'}`} onClick={()=>setCopyMode('move')}>✂️ 이동</button>
        </div>
        <div className="form-group">
          <label className="form-label">{copyMode==='copy'?'복사할 날짜':'이동할 날짜'}</label>
          <input className="form-input" type="date" value={copyDate} onChange={e=>setCopyDate(e.target.value)}/>
        </div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)}/>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 일정을 삭제하시겠어요?"/>
    </div>
  )
}
