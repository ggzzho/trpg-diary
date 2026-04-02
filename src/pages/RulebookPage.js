// src/pages/RulebookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { rulebooksApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', system_name:'', publisher:'', edition:'', cover_image_url:'', purchase_date:'', format:'physical', condition:'good', memo:'' }

// 빈 문자열 날짜를 null로 변환
const cleanPayload = (form) => ({
  ...form,
  purchase_date: form.purchase_date || null,
})

export function RulebookPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [ruleManager, setRuleManager] = useState(false)

  const load = async () => { const {data} = await rulebooksApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (editing) await rulebooksApi.update(editing.id, cleanPayload(form))
    else await rulebooksApi.create({...cleanPayload(form), user_id: user.id})
    setModal(false); load()
  }
  const remove = async id => { await rulebooksApi.remove(id); load() }

  const filtered = items.filter(i =>
    !search || i.title.includes(search) || i.system_name?.includes(search) || i.publisher?.includes(search)
  )

  const FORMAT_LABEL = { physical:'실물', digital:'전자', both:'실물+전자' }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📚 보유 룰북</h1>
          <p className="page-subtitle">보유한 TRPG 룰북 목록이에요 ({items.length}권)</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 룰북 추가</button>
      </div>

      <div style={{marginBottom:16}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}} />
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0
        ? <EmptyState icon="📚" title="룰북이 없어요" description="보유한 룰북을 추가해보세요!" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>} />
        : <div className="grid-auto">
            {filtered.map(item => (
              <div key={item.id} className="card">
                <div className="flex justify-between" style={{marginBottom:10}}>
                  <span className="badge badge-primary">{FORMAT_LABEL[item.format]||item.format}</span>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
                {item.cover_image_url && (
                  <img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:110,objectFit:'cover',borderRadius:6,marginBottom:10}} />
                )}
                <h3 style={{fontWeight:700,marginBottom:5,fontSize:'0.9rem'}}>{item.title}</h3>
                <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:3}}>
                  {item.system_name && <span>🎲 {item.system_name}</span>}
                  {item.publisher && <span>🏢 {item.publisher}</span>}
                  {item.edition && <span>📌 {item.edition}</span>}
                  {item.purchase_date && <span>🛒 {item.purchase_date}</span>}
                </div>
                {item.memo && <p className="text-sm" style={{marginTop:8,color:'var(--color-text-light)',borderTop:'1px solid var(--color-border)',paddingTop:8}}>{item.memo}</p>}
              </div>
            ))}
          </div>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'룰북 수정':'룰북 추가'}
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
          <input className="form-input" placeholder="크툴루의 부름 룰북" value={form.title} onChange={set('title')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">룰</label>
            <RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))} />
          </div>
          <div className="form-group">
            <label className="form-label">출판사</label>
            <input className="form-input" placeholder="KADOKAWA" value={form.publisher} onChange={set('publisher')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">판본 / 에디션</label>
            <input className="form-input" placeholder="7판" value={form.edition} onChange={set('edition')} />
          </div>
          <div className="form-group">
            <label className="form-label">형태</label>
            <select className="form-select" value={form.format} onChange={set('format')}>
              <option value="physical">실물</option><option value="digital">전자</option><option value="both">실물+전자</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">구매일</label>
            <input className="form-input" type="date" value={form.purchase_date||''} onChange={set('purchase_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">상태</label>
            <select className="form-select" value={form.condition} onChange={set('condition')}>
              <option value="new">새것</option><option value="good">양호</option><option value="fair">보통</option><option value="poor">손상</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">표지 이미지 URL</label>
          <input className="form-input" placeholder="https://..." value={form.cover_image_url} onChange={set('cover_image_url')} />
        </div>
        <div className="form-group">
          <label className="form-label">메모</label>
          <textarea className="form-textarea" value={form.memo} onChange={set('memo')} style={{minHeight:64}} />
        </div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)} />
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 룰북을 삭제하시겠어요?" />
    </div>
  )
}
