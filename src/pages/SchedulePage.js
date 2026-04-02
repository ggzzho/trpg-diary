// src/pages/SchedulePage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { schedulesApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'

const STATUS_MAP = {
  planned: { label: '예정', badge: 'badge-blue' },
  confirmed: { label: '확정', badge: 'badge-green' },
  completed: { label: '완료', badge: 'badge-gray' },
  cancelled: { label: '취소', badge: 'badge-red' },
}

const BLANK = {
  title: '', scheduled_date: '', scheduled_time: '',
  location: '', system_name: '', description: '',
  status: 'planned', is_gm: false
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
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar'
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [ruleManager, setRuleManager] = useState(false)

  const load = async () => {
    const { data } = await schedulesApi.getAll(user.id)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const openNew = () => {
    setEditing(null)
    setForm({...BLANK, scheduled_date: new Date().toISOString().split('T')[0]})
    setModal(true)
  }

  const openEdit = (item) => { setEditing(item); setForm({...item}); setModal(true) }

  const save = async () => {
    if (!form.title || !form.scheduled_date) return
    if (editing) await schedulesApi.update(editing.id, form)
    else await schedulesApi.create({...form, user_id: user.id})
    setModal(false); load()
  }

  const remove = async (id) => { await schedulesApi.remove(id); load() }

  const today = new Date().toISOString().split('T')[0]
  const filtered = items.filter(i => {
    if (filter === 'upcoming') return i.scheduled_date >= today && i.status !== 'cancelled'
    if (filter === 'past') return i.scheduled_date < today || i.status === 'completed'
    if (filter === 'cancelled') return i.status === 'cancelled'
    return true
  }).sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date))

  // ── 캘린더 렌더링 ───────────────────────────────────────────
  const renderCalendar = () => {
    const monthStart = startOfMonth(calendarDate)
    const monthEnd = endOfMonth(calendarDate)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const rows = []
    let day = startDate

    while (day <= endDate) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const d = day
        const dateStr = format(d, 'yyyy-MM-dd')
        const dayItems = items.filter(x => x.scheduled_date === dateStr)
        week.push(
          <div
            key={dateStr}
            className={`calendar-cell ${isToday(d) ? 'today' : ''} ${!isSameMonth(d, calendarDate) ? 'other-month' : ''}`}
            onClick={() => {
              setForm({...BLANK, scheduled_date: dateStr})
              setEditing(null)
              setModal(true)
            }}
          >
            <div className="calendar-date">{format(d, 'd')}</div>
            {dayItems.map(ev => (
              <div
                key={ev.id}
                className={`calendar-event ${ev.is_gm ? 'gm' : ''} ${ev.status === 'completed' ? 'completed' : ''} ${ev.status === 'cancelled' ? 'cancelled' : ''}`}
                onClick={e => { e.stopPropagation(); openEdit(ev) }}
                title={ev.title}
              >
                {ev.title}
              </div>
            ))}
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(<React.Fragment key={day.toString()}>{week}</React.Fragment>)
    }

    return (
      <div>
        {/* 캘린더 헤더 */}
        <div className="flex justify-between items-center" style={{marginBottom:16}}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalendarDate(subMonths(calendarDate, 1))}>‹ 이전</button>
          <span style={{fontWeight:700,fontSize:'1rem',color:'var(--color-accent)'}}>
            {format(calendarDate, 'yyyy년 M월', {locale:ko})}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalendarDate(addMonths(calendarDate, 1))}>다음 ›</button>
        </div>

        {/* 요일 헤더 */}
        <div className="calendar-grid" style={{marginBottom:3}}>
          {['일','월','화','수','목','금','토'].map(d => (
            <div key={d} className="calendar-day-header" style={{color: d==='일'?'#e57373':d==='토'?'#6b8cba':'var(--color-text-light)'}}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="calendar-grid">{rows}</div>

        {/* 범례 */}
        <div className="flex gap-12" style={{marginTop:12,flexWrap:'wrap'}}>
          {[
            {color:'var(--color-primary)',label:'PL'},
            {color:'var(--color-accent)',label:'GM'},
            {color:'#aaa',label:'완료'},
            {color:'#e57373',label:'취소'},
          ].map(l => (
            <div key={l.label} className="flex items-center gap-8">
              <div style={{width:10,height:10,borderRadius:2,background:l.color}} />
              <span className="text-xs text-light">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📅 일정 관리</h1>
          <p className="page-subtitle">예정된 세션과 지나간 플레이 일정을 관리해요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 일정 추가</button>
      </div>

      {/* 뷰 모드 + 필터 */}
      <div className="flex justify-between items-center" style={{marginBottom:20,flexWrap:'wrap',gap:8}}>
        <div className="flex gap-8">
          {[{k:'upcoming',l:'예정'},{k:'past',l:'지나간'},{k:'cancelled',l:'취소됨'},{k:'all',l:'전체'}].map(f => (
            <button key={f.k} className={`btn btn-sm ${filter===f.k?'btn-primary':'btn-outline'}`} onClick={()=>setFilter(f.k)}>{f.l}</button>
          ))}
        </div>
        <div className="flex gap-8">
          <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('list')}>≡ 리스트</button>
          <button className={`btn btn-sm ${viewMode==='calendar'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('calendar')}>📅 캘린더</button>
        </div>
      </div>

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <div className="card">{renderCalendar()}</div>
      )}

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
        loading ? <LoadingSpinner /> : filtered.length === 0
          ? <EmptyState icon="📅" title="일정이 없어요" description="새 일정을 추가해보세요!" action={<button className="btn btn-primary" onClick={openNew}>일정 추가하기</button>} />
          : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {filtered.map(item => (
                <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{background:'rgba(200,169,110,0.12)',borderRadius:8,padding:'8px 12px',textAlign:'center',minWidth:50,flexShrink:0}}>
                    <div style={{fontSize:'0.62rem',color:'var(--color-text-light)'}}>{format(new Date(item.scheduled_date),'M월',{locale:ko})}</div>
                    <div style={{fontSize:'1.3rem',color:'var(--color-accent)',fontWeight:700,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{format(new Date(item.scheduled_date),'d')}</div>
                    <div style={{fontSize:'0.62rem',color:'var(--color-text-light)'}}>{format(new Date(item.scheduled_date),'EEE',{locale:ko})}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div className="flex items-center gap-8" style={{marginBottom:3}}>
                      <span style={{fontWeight:600,fontSize:'0.88rem'}}>{item.title}</span>
                      <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`}>{STATUS_MAP[item.status]?.label}</span>
                      {item.is_gm && <span className="badge badge-primary">GM</span>}
                    </div>
                    <div className="text-xs text-light flex gap-12">
                      {item.system_name && <span>🎲 {item.system_name}</span>}
                      {item.scheduled_time && <span>🕐 {item.scheduled_time}</span>}
                      {item.location && <span>🖥️ {item.location}</span>}
                    </div>
                    {item.description && <p className="text-sm text-light" style={{marginTop:4}}>{item.description}</p>}
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {/* 등록/수정 모달 */}
      <Modal isOpen={modal} onClose={()=>setModal(false)}
        title={editing?'일정 수정':'새 일정 추가'}
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button>
            <button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button>
            <button className="btn btn-primary btn-sm" onClick={save}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">제목 *</label>
          <input className="form-input" placeholder="세션명 또는 일정명" value={form.title} onChange={set('title')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">날짜 *</label>
            <input className="form-input" type="date" value={form.scheduled_date} onChange={set('scheduled_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">시간</label>
            <input className="form-input" type="time" value={form.scheduled_time} onChange={set('scheduled_time')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">룰</label>
            <RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))} />
          </div>
          <div className="form-group">
            <label className="form-label">툴</label>
            <input className="form-input" placeholder="roll20, 코코포리아..." value={form.location} onChange={set('location')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">상태</label>
            <select className="form-select" value={form.status} onChange={set('status')}>
              <option value="planned">예정</option>
              <option value="confirmed">확정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">역할</label>
            <select className="form-select" value={form.is_gm?'gm':'pl'} onChange={e=>setForm(f=>({...f,is_gm:e.target.value==='gm'}))}>
              <option value="pl">PL (플레이어)</option>
              <option value="gm">GM (게임 마스터)</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">메모</label>
          <textarea className="form-textarea" placeholder="준비할 사항, 참가자 등..." value={form.description} onChange={set('description')} style={{minHeight:72}} />
        </div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)} />
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 일정을 삭제하시겠어요?" />
    </div>
  )
}
