// src/pages/AvailabilityPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { availabilityApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', role:'PL', system_name:'', preferred_days:[], preferred_time:'', description:'', together_with:'', scenario_link:'', is_active:true }
const DAYS = ['월','화','수','목','금','토','일']

export function AvailabilityPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [ruleManager, setRuleManager] = useState(false)

  const load = async () => { const {data}=await availabilityApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const toggleDay = d => setForm(f => ({...f, preferred_days: f.preferred_days?.includes(d) ? f.preferred_days.filter(x=>x!==d) : [...(f.preferred_days||[]),d]}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (editing) await availabilityApi.update(editing.id, form)
    else await availabilityApi.create({...form, user_id: user.id})
    setModal(false); load()
  }
  const remove = async id => { await availabilityApi.remove(id); load() }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📋 공수표 목록</h1>
          <p className="page-subtitle">플레이 가능한 날짜와 원하는 조건을 공개해요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 공수표 추가</button>
      </div>

      {loading ? <LoadingSpinner /> : items.length===0
        ? <EmptyState icon="📋" title="공수표가 없어요" action={<button className="btn btn-primary" onClick={openNew}>등록하기</button>} />
        : <div className="grid-auto">
            {items.map(item=>(
              <div key={item.id} className="card">
                <div className="flex justify-between items-center" style={{marginBottom:10}}>
                  <div className="flex gap-8">
                    <span className={`badge ${item.is_active?'badge-green':'badge-gray'}`}>{item.is_active?'활성':'비활성'}</span>
                    <span className="badge badge-primary">{item.role}</span>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
                <h3 style={{fontWeight:600,marginBottom:7,fontSize:'0.9rem'}}>{item.title}</h3>
                <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:3}}>
                  {item.system_name&&<span>🎲 {item.system_name}</span>}
                  {item.preferred_days?.length>0&&<span>📅 {item.preferred_days.join(', ')}요일</span>}
                  {item.preferred_time&&<span>🕐 {item.preferred_time}</span>}
                  {item.together_with&&<span>👥 {item.together_with}</span>}
                </div>
                {item.description&&<p className="text-sm" style={{marginTop:8,color:'var(--color-text-light)'}}>{item.description}</p>}
                {item.scenario_link&&(
                  <a href={item.scenario_link} target="_blank" rel="noreferrer" className="text-sm" style={{marginTop:7,display:'block',color:'var(--color-primary)'}}>🔗 시나리오 링크</a>
                )}
              </div>
            ))}
          </div>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'공수표 수정':'공수표 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">시나리오명 *</label><input className="form-input" placeholder="시나리오명" value={form.title} onChange={set('title')} /></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">역할</label>
            <select className="form-select" value={form.role} onChange={set('role')}><option value="PL">PL</option><option value="GM">GM</option><option value="both">둘 다</option></select>
          </div>
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))} /></div>
        </div>
        <div className="form-group"><label className="form-label">선호 요일</label>
          <div className="flex gap-8" style={{flexWrap:'wrap'}}>
            {DAYS.map(d=>(
              <button key={d} type="button" className={`btn btn-sm ${form.preferred_days?.includes(d)?'btn-primary':'btn-outline'}`} onClick={()=>toggleDay(d)} style={{minWidth:34,justifyContent:'center'}}>{d}</button>
            ))}
          </div>
        </div>
        <div className="form-group"><label className="form-label">선호 시간대</label><input className="form-input" placeholder="저녁 7시 이후..." value={form.preferred_time} onChange={set('preferred_time')} /></div>
        <div className="form-group"><label className="form-label">상세 내용</label><textarea className="form-textarea" placeholder="원하는 장르, 분위기 등..." value={form.description} onChange={set('description')} style={{minHeight:72}} /></div>
        <div className="form-group"><label className="form-label">함께한 사람</label><input className="form-input" placeholder="함께할 분의 닉네임..." value={form.together_with||''} onChange={set('together_with')} /></div>
        <div className="form-group"><label className="form-label">시나리오 링크 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_link||''} onChange={set('scenario_link')} /></div>
        <div className="form-group"><label className="form-label">공개 상태</label>
          <select className="form-select" value={form.is_active?'active':'inactive'} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='active'}))}>
            <option value="active">활성 (공개)</option><option value="inactive">비활성 (숨김)</option>
          </select>
        </div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)} />
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 공수표를 삭제하시겠어요?" />
    </div>
  )
}
