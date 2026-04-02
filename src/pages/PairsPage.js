// src/pages/PairsPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { pairsApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'

const COLORS = ['#c8a96e','#8b9dc3','#9bc4a0','#c48b8b','#b8a0c8','#c4b08b','#8bbfc4']
const BLANK = { name:'', nickname:'', contact:'', first_met_date:'', systems:[], memo:'', relation:'both', play_count:0, avatar_color:'#c8a96e' }

const cleanPayload = (form) => ({
  ...form,
  first_met_date: form.first_met_date || null,
  play_count: form.play_count === '' ? 0 : parseInt(form.play_count) || 0,
  systems: typeof form.systems === 'string'
    ? form.systems.split(',').map(s=>s.trim()).filter(Boolean)
    : (form.systems || []),
})

export function PairsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => { const { data } = await pairsApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const openNew = () => { setEditing(null); setForm({...BLANK, avatar_color: COLORS[Math.floor(Math.random()*COLORS.length)]}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item, systems: item.systems||[]}); setModal(true) }
  const save = async () => {
    if (!form.name) return
    const payload = cleanPayload(form)
    if (editing) await pairsApi.update(editing.id, payload)
    else await pairsApi.create({...payload, user_id: user.id})
    setModal(false); load()
  }
  const remove = async id => { await pairsApi.remove(id); load() }

  const filtered = items.filter(i => !search || i.name.includes(search) || i.nickname?.includes(search))

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">👥 페어 목록</h1>
          <p className="page-subtitle">함께한 소중한 동료들을 기록해요 ({items.length}명)</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 페어 추가</button>
      </div>

      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 이름으로 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:300}} />
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0
        ? <EmptyState icon="👥" title="페어가 없어요" description="함께 플레이한 분들을 추가해보세요!" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>} />
        : <div className="grid-auto">
            {filtered.map(item => (
              <div key={item.id} className="card">
                <div className="flex justify-between items-start" style={{marginBottom:14}}>
                  <div className="flex gap-12 items-center">
                    <div style={{width:44,height:44,borderRadius:'50%',background:item.avatar_color||'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'1.1rem',flexShrink:0}}>
                      {(item.name||'?')[0]}
                    </div>
                    <div>
                      <div style={{fontWeight:600,fontSize:'0.95rem'}}>{item.name}</div>
                      {item.nickname && <div className="text-xs text-light">@{item.nickname}</div>}
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
                <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:4}}>
                  <span className="badge badge-primary" style={{display:'inline-flex',width:'fit-content'}}>{item.relation}</span>
                  {item.play_count > 0 && <span>🎲 {item.play_count}회 함께 플레이</span>}
                  {item.first_met_date && <span>📅 {item.first_met_date} 첫 만남</span>}
                  {item.systems?.length > 0 && <span>📌 {item.systems.join(', ')}</span>}
                  {item.contact && <span>📬 {item.contact}</span>}
                </div>
                {item.memo && <p className="text-sm" style={{marginTop:10,color:'var(--color-text-light)',borderTop:'1px solid var(--color-border)',paddingTop:10}}>{item.memo}</p>}
              </div>
            ))}
          </div>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'페어 수정':'페어 추가'}
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button>
            <button className="btn btn-primary btn-sm" onClick={save}>저장</button>
          </>
        }
      >
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">이름 *</label>
            <input className="form-input" value={form.name} onChange={set('name')} />
          </div>
          <div className="form-group">
            <label className="form-label">닉네임</label>
            <input className="form-input" placeholder="온라인 닉네임" value={form.nickname} onChange={set('nickname')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">관계</label>
            <select className="form-select" value={form.relation} onChange={set('relation')}>
              <option value="PL">같이 PL</option><option value="GM">GM 해준 분</option><option value="both">둘 다</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">함께 플레이 횟수</label>
            <input className="form-input" type="number" min="0" value={form.play_count} onChange={set('play_count')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">아바타 색상</label>
          <div className="flex gap-8" style={{flexWrap:'wrap'}}>
            {COLORS.map(c => (
              <div key={c} onClick={()=>setForm(f=>({...f,avatar_color:c}))}
                style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:form.avatar_color===c?'3px solid var(--color-text)':'3px solid transparent'}}
              />
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">함께한 시스템 (쉼표로 구분)</label>
          <input className="form-input" placeholder="CoC, D&D, 나이트메어..." value={Array.isArray(form.systems)?form.systems.join(', '):form.systems} onChange={set('systems')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">처음 만난 날</label>
            <input className="form-input" type="date" value={form.first_met_date||''} onChange={set('first_met_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">연락처</label>
            <input className="form-input" placeholder="SNS / 트위터..." value={form.contact} onChange={set('contact')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">메모</label>
          <textarea className="form-textarea" value={form.memo} onChange={set('memo')} style={{minHeight:70}} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 페어를 삭제하시겠어요?" />
    </div>
  )
}
