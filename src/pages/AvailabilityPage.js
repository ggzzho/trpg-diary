// src/pages/AvailabilityPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { availabilityApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { RuleSelect } from '../components/RuleSelect'

const BLANK = { title:'', role:'PL', system_name:'', description:'', together_with:'', scenario_link:'', is_active:true }

export function AvailabilityPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [viewMode, setViewMode] = useState('card')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('asc')

  useEffect(() => { if (profile?.availability_sort_order) setSortOrder(profile.availability_sort_order) }, [profile])
  const load = async () => { const {data}=await availabilityApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const filtered = items
    .filter(i => !search || i.title?.includes(search) || i.system_name?.includes(search) || i.together_with?.includes(search))
    .sort((a,b) => {
      const ta=(a.title||'').toLowerCase(), tb=(b.title||'').toLowerCase()
      return sortOrder==='asc' ? ta.localeCompare(tb,'ko') : tb.localeCompare(ta,'ko')
    })
  const { paged, page, setPage, perPage, setPerPage } = usePagination(filtered, 20)

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (!editing && items.length >= 3000) { alert('게시판의 최대 등록 갯수를 초과하여 저장할 수 없습니다. 공수표 목록을 정리해주세요.'); return }
    const { id, user_id, created_at, ...formFields } = form
    if (editing) await availabilityApi.update(editing.id, formFields)
    else await availabilityApi.create({...formFields,user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await availabilityApi.remove(id); load() }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>event_available</Mi>공수표 목록</h1><p className="page-subtitle">플레이 약속을 기록해요</p></div>
        <div className="flex gap-8">
          <button className={`btn btn-sm ${viewMode==='card'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('card')}><Mi size='sm'>grid_view</Mi> 카드</button>
          <button className={`btn btn-sm ${viewMode==='list'?'btn-primary':'btn-outline'}`} onClick={()=>setViewMode('list')}><Mi size='sm'>list</Mi> 리스트</button>
          <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 추가</button>
        </div>
      </div>

      <div style={{marginBottom:16, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
        <input className="form-input" placeholder="🔍 제목, 룰, 받는 사람 검색..." value={search}
          onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}}/>
        <button className={`btn btn-sm ${sortOrder==='asc'?'btn-primary':'btn-outline'}`}
          onClick={async()=>{ const next=sortOrder==='asc'?'desc':'asc'; setSortOrder(next); await supabase.from('profiles').update({availability_sort_order:next}).eq('id',user.id) }}>
          가나다순 {sortOrder==='asc'?'↑':'↓'}
        </button>
      </div>

      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="event_available" title="공수표가 없어요" action={<button className="btn btn-primary" onClick={openNew}>등록하기</button>}/>
        :viewMode==='card'
          ?<>
            <div className="grid-auto">
            {paged.map(item=>(
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
                  {item.system_name&&<span><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
                  {item.together_with&&<span><Mi size='sm' color='light'>person</Mi> {item.together_with}</span>}
                </div>
                {item.description&&<p className="text-sm" style={{marginTop:8,color:'var(--color-text-light)'}}>{item.description}</p>}
                {item.scenario_link&&<a href={item.scenario_link} target="_blank" rel="noreferrer" className="text-sm" style={{marginTop:7,display:'block',color:'var(--color-primary)'}}><Mi size="sm">link</Mi> 시나리오 링크</a>}
              </div>
            ))}
            </div>
            <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
          </>
          :<>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {paged.map(item=>(
              <div key={item.id} className="card card-sm">
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div className="flex gap-8" style={{flexShrink:0,paddingTop:2}}>
                    <span className={`badge ${item.is_active?'badge-green':'badge-gray'}`}>{item.is_active?'활성':'비활성'}</span>
                    <span className="badge badge-primary">{item.role}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'0.9rem',marginBottom:5}}>{item.title}</div>
                    <div className="text-xs text-light" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:item.description||item.together_with?6:0}}>
                      {item.system_name&&<span><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
                      {item.together_with&&<span><Mi size='sm' color='light'>person</Mi> {item.together_with}</span>}
                    </div>
                    {item.description&&<p className="text-sm text-light">{item.description}</p>}
                    {item.scenario_link&&<a href={item.scenario_link} target="_blank" rel="noreferrer" style={{fontSize:'0.78rem',color:'var(--color-primary)',marginTop:4,display:'block'}}><Mi size="sm">link</Mi> 시나리오 링크</a>}
                  </div>
                  <div className="flex gap-8" style={{flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
            </div>
            <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
          </>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'공수표 수정':'공수표 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">시나리오명 *</label><input className="form-input" placeholder="시나리오명" value={form.title} onChange={set('title')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">희망/예정</label>
            <select className="form-select" value={form.role} onChange={set('role')}><option value="PL">PL</option><option value="GM">GM</option><option value="both">둘 다</option></select>
          </div>
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">상세 내용</label><textarea className="form-textarea" value={form.description} onChange={set('description')} style={{minHeight:72}}/></div>
        <div className="form-group"><label className="form-label">받는 사람</label><input className="form-input" placeholder="닉네임" value={form.together_with||''} onChange={set('together_with')}/></div>
        <div className="form-group"><label className="form-label">시나리오 링크 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_link||''} onChange={set('scenario_link')}/></div>
        <div className="form-group"><label className="form-label">공개 상태</label>
          <select className="form-select" value={form.is_active?'active':'inactive'} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='active'}))}>
            <option value="active">활성 (공개)</option><option value="inactive">비활성 (숨김)</option>
          </select>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 공수표를 삭제하시겠어요?"/>
    </div>
  )
}
