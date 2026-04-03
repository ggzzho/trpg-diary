// src/pages/ScenarioPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { scenariosApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { Mi } from '../components/Mi'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', system_name:'', author:'', cover_image_url:'', player_count:'', format:'physical', status:'unplayed', memo:'', purchase_date:'', scenario_url:'' }
const STATUS_MAP = { unplayed:{label:'미플',badge:'badge-gray'}, played:{label:'PL 완료',badge:'badge-green'}, gm_done:{label:'GM 완료',badge:'badge-primary'}, want:{label:'위시리스트',badge:'badge-blue'} }
const cleanPayload = f => ({...f, purchase_date:f.purchase_date||null})

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

  const load = async () => { const {data}=await scenariosApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (editing) await scenariosApi.update(editing.id, cleanPayload(form))
    else await scenariosApi.create({...cleanPayload(form),user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await scenariosApi.remove(id); load() }

  const filtered = items
    .filter(i=>statusFilter==='all'||i.status===statusFilter)
    .filter(i=>!search||i.title.includes(search)||i.system_name?.includes(search)||i.author?.includes(search))

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>description</Mi>시나리오 목록</h1><p className="page-subtitle">보유/위시 TRPG 시나리오 목록이예요 ({items.length}개)</p></div>
        <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 시나리오 추가</button>
      </div>

      <div className="flex gap-8" style={{marginBottom:12,flexWrap:'wrap'}}>
        {['all','unplayed','played','gm_done','want'].map(s=>(
          <button key={s} className={`btn btn-sm ${statusFilter===s?'btn-primary':'btn-outline'}`} onClick={()=>setStatusFilter(s)}>
            {s==='all'?'전체':STATUS_MAP[s]?.label}
          </button>
        ))}
      </div>
      <div style={{marginBottom:16}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}}/>
      </div>

      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="description" title="시나리오가 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(item=>(
            <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {item.cover_image_url?<img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.5rem',opacity:0.4}}><Mi size="lg" color="light">description</Mi></span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div className="flex items-center gap-8" style={{marginBottom:5}}>
                  <span style={{fontWeight:700,fontSize:'0.9rem'}}>{item.title}</span>
                  <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`}>{STATUS_MAP[item.status]?.label}</span>
                </div>
                {/* 항목 간격 추가 */}
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {item.system_name&&<span className="text-xs text-light"><><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</></span>}
                  {item.author&&<span className="text-xs text-light"><><Mi size='sm' color='light'>person</Mi> {item.author}</></span>}
                  {item.player_count&&<span className="text-xs text-light"><><Mi size='sm' color='light'>group</Mi> {item.player_count}</></span>}
                </div>
                {item.scenario_url&&<a href={item.scenario_url} target="_blank" rel="noreferrer" style={{fontSize:'0.7rem',color:'var(--color-primary)',marginTop:3,display:'block'}}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
                {item.memo&&<p className="text-xs text-light" style={{marginTop:3}}>{item.memo}</p>}
              </div>
              <div className="flex gap-8">
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'시나리오 수정':'시나리오 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" placeholder="어둠 속의 가면" value={form.title} onChange={set('title')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
          <div className="form-group"><label className="form-label">라이터</label><input className="form-input" value={form.author||''} onChange={set('author')}/></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">인원</label><input className="form-input" placeholder="3~5인, 다인, 타이..." value={form.player_count||''} onChange={set('player_count')}/></div>
          <div className="form-group"><label className="form-label">형태</label><select className="form-select" value={form.format} onChange={set('format')}><option value="physical">실물</option><option value="digital">전자</option><option value="both">둘 다</option></select></div>
        </div>
        <div className="form-group"><label className="form-label">상태</label>
          <select className="form-select" value={form.status} onChange={set('status')}>
            <option value="unplayed">미플</option><option value="played">PL 완료</option><option value="gm_done">GM 완료</option><option value="want">위시리스트</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">시나리오 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_url||''} onChange={set('scenario_url')}/></div>
        <div className="form-group"><label className="form-label">표지 이미지 URL</label><input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.cover_image_url||''} onChange={set('cover_image_url')}/></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:64}}/></div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)}/>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 시나리오를 삭제하시겠어요?"/>
    </div>
  )
}
