// src/pages/ScenarioPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { scenariosApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', system_name:'', author:'', publisher:'', cover_image_url:'', player_count:'', estimated_time:'', difficulty:'beginner', format:'physical', status:'unplayed', memo:'', purchase_date:'' }
const STATUS_MAP = { unplayed:{label:'미플',badge:'badge-gray'}, played:{label:'PL 완료',badge:'badge-green'}, gm_done:{label:'GM 완료',badge:'badge-primary'}, want:{label:'위시리스트',badge:'badge-blue'} }
const DIFF_MAP = { beginner:'입문', intermediate:'중급', advanced:'고급', expert:'전문가' }

export function ScenarioPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [ruleManager, setRuleManager] = useState(false)

  const load = async () => { const {data} = await scenariosApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (editing) await scenariosApi.update(editing.id, form)
    else await scenariosApi.create({...form, user_id: user.id})
    setModal(false); load()
  }
  const remove = async id => { await scenariosApi.remove(id); load() }

  const filtered = items
    .filter(i => statusFilter==='all' || i.status===statusFilter)
    .filter(i => !search || i.title.includes(search) || i.system_name?.includes(search))

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">🗺️ 보유 시나리오</h1>
          <p className="page-subtitle">보유한 TRPG 시나리오 목록이에요 ({items.length}개)</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 시나리오 추가</button>
      </div>

      <div className="flex gap-8" style={{marginBottom:12,flexWrap:'wrap'}}>
        {['all','unplayed','played','gm_done','want'].map(s=>(
          <button key={s} className={`btn btn-sm ${statusFilter===s?'btn-primary':'btn-outline'}`} onClick={()=>setStatusFilter(s)}>
            {s==='all'?'전체':STATUS_MAP[s]?.label}
          </button>
        ))}
      </div>
      <div style={{marginBottom:16}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}} />
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0
        ? <EmptyState icon="🗺️" title="시나리오가 없어요" description="보유한 시나리오를 등록해보세요!" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>} />
        : <div className="grid-auto">
            {filtered.map(item => (
              <div key={item.id} className="card">
                <div className="flex justify-between" style={{marginBottom:8}}>
                  <div className="flex gap-8">
                    <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`}>{STATUS_MAP[item.status]?.label}</span>
                    {item.difficulty && <span className="badge badge-gray">{DIFF_MAP[item.difficulty]}</span>}
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
                {item.cover_image_url && (
                  <img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:90,objectFit:'cover',borderRadius:6,marginBottom:8}} />
                )}
                <h3 style={{fontWeight:700,marginBottom:5,fontSize:'0.9rem'}}>{item.title}</h3>
                <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:3}}>
                  {item.system_name && <span>🎲 {item.system_name}</span>}
                  {item.author && <span>✏️ {item.author}</span>}
                  {item.player_count && <span>👥 {item.player_count}인</span>}
                  {item.estimated_time && <span>⏱️ {item.estimated_time}</span>}
                </div>
                {item.memo && <p className="text-sm" style={{marginTop:8,color:'var(--color-text-light)',borderTop:'1px solid var(--color-border)',paddingTop:8}}>{item.memo}</p>}
              </div>
            ))}
          </div>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'시나리오 수정':'시나리오 추가'}
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
          <input className="form-input" placeholder="어둠 속의 가면" value={form.title} onChange={set('title')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">룰</label>
            <RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))} />
          </div>
          <div className="form-group">
            <label className="form-label">작가</label>
            <input className="form-input" value={form.author} onChange={set('author')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">인원수</label>
            <input className="form-input" placeholder="3~5" value={form.player_count} onChange={set('player_count')} />
          </div>
          <div className="form-group">
            <label className="form-label">예상 플레이 시간</label>
            <input className="form-input" placeholder="4~6시간" value={form.estimated_time} onChange={set('estimated_time')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">난이도</label>
            <select className="form-select" value={form.difficulty} onChange={set('difficulty')}>
              <option value="beginner">입문</option><option value="intermediate">중급</option><option value="advanced">고급</option><option value="expert">전문가</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">형태</label>
            <select className="form-select" value={form.format} onChange={set('format')}>
              <option value="physical">실물</option><option value="digital">전자</option><option value="both">둘 다</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">상태</label>
          <select className="form-select" value={form.status} onChange={set('status')}>
            <option value="unplayed">미플</option><option value="played">PL 완료</option><option value="gm_done">GM 완료</option><option value="want">위시리스트</option>
          </select>
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
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 시나리오를 삭제하시겠어요?" />
    </div>
  )
}
