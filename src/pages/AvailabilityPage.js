// src/pages/AvailabilityPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { availabilityApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', role:'PL', system_name:'', description:'', together_with:'', scenario_link:'', is_active:true }

export function AvailabilityPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [ruleManager, setRuleManager] = useState(false)
  const [viewMode, setViewMode] = useState('card')

  const load = async () => { const {data}=await availabilityApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (editing) await availabilityApi.update(editing.id, form)
    else await availabilityApi.create({...form,user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await availabilityApi.remove(id); load() }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title">📋 공수표 목록</h1><p className="page-subtitle">플레이 가능한 날짜와 원하는 조건을 공개해요</p></div>
        <div className="flex gap-8">
          <button className={`btn btn-sm ${viewMode==='card'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('card')}>☰ 카드</button>
          <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('list')}>≡ 리스트</button>
          <button className="btn btn-primary" onClick={openNew}>+ 추가</button>
        </div>
      </div>

      {loading?<LoadingSpinner/>:items.length===0
        ?<EmptyState icon="📋" title="공수표가 없어요" action={<button className="btn btn-primary" onClick={openNew}>등록하기</button>}/>
        :viewMode==='card'
          ?<div className="grid-auto">
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
                  {item.together_with&&<span>👤 {item.together_with}</span>}
                </div>
                {item.description&&<p className="text-sm" style={{marginTop:8,color:'var(--color-text-light)'}}>{item.description}</p>}
                {item.scenario_link&&<a href={item.scenario_link} target="_blank" rel="noreferrer" className="text-sm" style={{marginTop:7,display:'block',color:'var(--color-primary)'}}>🔗 시나리오 링크</a>}
              </div>
            ))}
          </div>
          :<div style={{display:'flex',flexDirection:'column',gap:12}}>
            {items.map(item=>(
              <div key={item.id} className="card card-sm">
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div className="flex gap-8" style={{flexShrink:0,paddingTop:2}}>
                    <span className={`badge ${item.is_active?'badge-green':'badge-gray'}`}>{item.is_active?'활성':'비활성'}</span>
                    <span className="badge badge-primary">{item.role}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'0.9rem',marginBottom:5}}>{item.title}</div>
                    <div className="text-xs text-light" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:item.description||item.together_with?6:0}}>
                      {item.system_name&&<span>🎲 {item.system_name}</span>}
                      {item.together_with&&<span>👤 {item.together_with}</span>}
                    </div>
                    {item.description&&<p className="text-sm text-light">{item.description}</p>}
                    {item.scenario_link&&<a href={item.scenario_link} target="_blank" rel="noreferrer" style={{fontSize:'0.78rem',color:'var(--color-primary)',marginTop:4,display:'block'}}>🔗 시나리오 링크</a>}
                  </div>
                  <div className="flex gap-8" style={{flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'공수표 수정':'공수표 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">시나리오명 *</label><input className="form-input" placeholder="시나리오명" value={form.title} onChange={set('title')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">희망</label>
            <select className="form-select" value={form.role} onChange={set('role')}><option value="PL">PL</option><option value="GM">GM</option><option value="both">둘 다</option></select>
          </div>
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">상세 내용</label><textarea className="form-textarea" value={form.description} onChange={set('description')} style={{minHeight:72}}/></div>
        <div className="form-group"><label className="form-label">공수표 받은 사람</label><input className="form-input" placeholder="닉네임" value={form.together_with||''} onChange={set('together_with')}/></div>
        <div className="form-group"><label className="form-label">시나리오 링크 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_link||''} onChange={set('scenario_link')}/></div>
        <div className="form-group"><label className="form-label">공개 상태</label>
          <select className="form-select" value={form.is_active?'active':'inactive'} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='active'}))}>
            <option value="active">활성 (공개)</option><option value="inactive">비활성 (숨김)</option>
          </select>
        </div>
      </Modal>
      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)}/>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 공수표를 삭제하시겠어요?"/>
    </div>
  )
}
