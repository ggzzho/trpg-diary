// src/pages/PlayLogPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { playLogsApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, StarRating } from '../components/Layout'
import { format } from 'date-fns'

const BLANK = {
  title: '', played_date: '', system_name: '', scenario_name: '',
  role: 'PL', character_name: '', gm_name: '', venue: '',
  rating: 0, memo: ''
}

export function PlayLogPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = async () => { const { data } = await playLogsApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const openNew = () => { setEditing(null); setForm({...BLANK, played_date: new Date().toISOString().split('T')[0]}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title || !form.played_date) return
    if (editing) await playLogsApi.update(editing.id, form)
    else await playLogsApi.create({...form, user_id: user.id})
    setModal(false); load()
  }
  const remove = async id => { await playLogsApi.remove(id); load() }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📖 다녀온 기록</h1>
          <p className="page-subtitle">플레이한 세션들의 소중한 기억을 남겨요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 기록 추가</button>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0
        ? <EmptyState icon="📖" title="아직 기록이 없어요" description="첫 번째 플레이 기록을 남겨보세요!" action={<button className="btn btn-primary" onClick={openNew}>기록 추가</button>} />
        : <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {items.map(item => (
              <div key={item.id} className="card card-sm" style={{display:'flex',gap:16,alignItems:'flex-start',cursor:'pointer'}} onClick={()=>setDetail(item)}>
                <div style={{background:'rgba(200,169,110,0.1)',borderRadius:10,padding:'8px 12px',textAlign:'center',minWidth:52,flexShrink:0}}>
                  <div style={{fontSize:'0.65rem',color:'var(--color-text-light)'}}>
                    {format(new Date(item.played_date),'yyyy')}
                  </div>
                  <div className="text-serif" style={{fontSize:'1rem',color:'var(--color-accent)',fontWeight:700}}>
                    {format(new Date(item.played_date),'M/d')}
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div className="flex items-center gap-8" style={{marginBottom:4}}>
                    <span style={{fontWeight:600,fontSize:'0.95rem'}}>{item.title}</span>
                    <span className={`badge ${item.role==='GM'?'badge-primary':'badge-blue'}`}>{item.role}</span>
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {item.system_name && <span>🎲 {item.system_name}</span>}
                    {item.character_name && <span>👤 {item.character_name}</span>}
                    {item.venue && <span>📍 {item.venue}</span>}
                  </div>
                  {item.rating > 0 && <div className="stars" style={{fontSize:'0.85rem',marginTop:4}}>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</div>}
                </div>
                <div className="flex gap-8" onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
      }

      {/* 상세 보기 모달 */}
      <Modal isOpen={!!detail} onClose={()=>setDetail(null)} title={detail?.title}
        footer={<button className="btn btn-outline" onClick={()=>setDetail(null)}>닫기</button>}
      >
        {detail && (
          <div>
            <div className="grid-2" style={{marginBottom:16}}>
              <div><div className="form-label">날짜</div><div>{format(new Date(detail.played_date),'yyyy년 M월 d일')}</div></div>
              <div><div className="form-label">역할</div><div>{detail.role}</div></div>
              {detail.system_name && <div><div className="form-label">시스템</div><div>{detail.system_name}</div></div>}
              {detail.scenario_name && <div><div className="form-label">시나리오</div><div>{detail.scenario_name}</div></div>}
              {detail.character_name && <div><div className="form-label">캐릭터명</div><div>{detail.character_name}</div></div>}
              {detail.gm_name && <div><div className="form-label">GM</div><div>{detail.gm_name}</div></div>}
              {detail.venue && <div><div className="form-label">장소</div><div>{detail.venue}</div></div>}
            </div>
            {detail.rating > 0 && <div style={{marginBottom:12}}><div className="form-label">평점</div><StarRating value={detail.rating} readOnly /></div>}
            {detail.memo && <div><div className="form-label">메모</div><p style={{color:'var(--color-text-light)',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{detail.memo}</p></div>}
          </div>
        )}
      </Modal>

      {/* 등록/수정 모달 */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'기록 수정':'기록 추가'}
        footer={<><button className="btn btn-outline" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary" onClick={save}>저장</button></>}
      >
        <div className="form-group">
          <label className="form-label">제목 (세션명) *</label>
          <input className="form-input" placeholder="크툴루의 부름 - 어둠 속의 가면" value={form.title} onChange={set('title')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">날짜 *</label>
            <input className="form-input" type="date" value={form.played_date} onChange={set('played_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">역할</label>
            <select className="form-select" value={form.role} onChange={set('role')}>
              <option value="PL">PL</option><option value="GM">GM</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">시스템</label>
            <input className="form-input" placeholder="CoC 7th..." value={form.system_name} onChange={set('system_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">시나리오명</label>
            <input className="form-input" placeholder="어둠 속의 가면" value={form.scenario_name} onChange={set('scenario_name')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">캐릭터명 (PL의 경우)</label>
            <input className="form-input" placeholder="홍길동" value={form.character_name} onChange={set('character_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">GM 이름</label>
            <input className="form-input" placeholder="GM 닉네임" value={form.gm_name} onChange={set('gm_name')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">장소</label>
          <input className="form-input" placeholder="온라인 / 홍대..." value={form.venue} onChange={set('venue')} />
        </div>
        <div className="form-group">
          <label className="form-label">평점</label>
          <StarRating value={form.rating} onChange={v => setForm(f=>({...f, rating:v}))} />
        </div>
        <div className="form-group">
          <label className="form-label">플레이 소감 / 메모</label>
          <textarea className="form-textarea" placeholder="오늘 세션은..." value={form.memo} onChange={set('memo')} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 기록을 삭제하시겠어요?" />
    </div>
  )
}
