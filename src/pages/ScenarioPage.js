// src/pages/ScenarioPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { scenariosApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { RuleSelect } from '../components/RuleSelect'

const BLANK = { title:'', parent_id:null, system_name:'', author:'', cover_image_url:'', player_count:'', format:'physical', status:'unplayed', memo:'', purchase_date:'', scenario_url:'' }
const STATUS_MAP = { unplayed:{label:'미플',badge:'badge-gray'}, played:{label:'PL 완료',badge:'badge-green'}, gm_done:{label:'GM 완료',badge:'badge-primary'}, want:{label:'위시리스트',badge:'badge-blue'} }
const cleanPayload = f => { const { id, user_id, created_at, ...rest } = f; return {...rest, purchase_date:f.purchase_date||null, parent_id:f.parent_id||null} }

export function ScenarioPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState(() => 'asc')
  const [isChild, setIsChild] = useState(false)
  const [expanded, setExpanded] = useState({})

  const load = async () => { const {data}=await scenariosApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])
  useEffect(() => { if (profile?.scenario_sort_order) setSortOrder(profile.scenario_sort_order) }, [profile])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setIsChild(false); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setIsChild(!!item.parent_id); setModal(true) }
  const save = async () => {
    if (!form.title) return
    const payload = cleanPayload({...form, parent_id: isChild ? (form.parent_id||null) : null})
    if (editing) await scenariosApi.update(editing.id, payload)
    else await scenariosApi.create({...payload, user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await scenariosApi.remove(id); load() }
  const toggleExpand = id => setExpanded(e => ({...e, [id]:!e[id]}))

  const parents = useMemo(() => items.filter(i => !i.parent_id), [items])
  const childMap = useMemo(() => {
    const m = {}
    items.filter(i => i.parent_id).forEach(i => {
      if (!m[i.parent_id]) m[i.parent_id] = []
      m[i.parent_id].push(i)
    })
    return m
  }, [items])

  // 검색어 있을 때 하위 매칭 항목 자동 펼침 (parents/childMap useMemo 아래 위치)
  useEffect(() => {
    if (!search || !parents?.length) { return }
    const s = search.toLowerCase()
    const matchItem = (i) => !!(
      i.title?.toLowerCase().includes(s)
      || i.system_name?.toLowerCase().includes(s)
      || i.author?.toLowerCase().includes(s)
      || i.memo?.toLowerCase().includes(s)
    )
    const autoExpand = {}
    parents.forEach(p => {
      if (childMap[p.id]?.some(c => matchItem(c))) autoExpand[p.id] = true
    })
    setExpanded(autoExpand)
  }, [search, parents, childMap])

  const filteredParents = useMemo(() => {
    const s = search.toLowerCase()
    const matchItem = (i) => !s
      || i.title?.toLowerCase().includes(s)
      || i.system_name?.toLowerCase().includes(s)
      || i.author?.toLowerCase().includes(s)
      || i.memo?.toLowerCase().includes(s)

    return parents
      .filter(i => {
        const matchStatus = statusFilter==='all' || i.status===statusFilter
        const matchParent = matchItem(i)
        const matchChild = childMap[i.id]?.some(c => matchItem(c))
        return matchStatus && (matchParent || matchChild)
      })
      .sort((a,b) => {
        const ta=a.title.toLowerCase(), tb=b.title.toLowerCase()
        return sortOrder==='asc' ? ta.localeCompare(tb,'ko') : tb.localeCompare(ta,'ko')
      })
  }, [parents, statusFilter, search, sortOrder, childMap])

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filteredParents, 20)
  const parentOptions = parents.filter(p => !editing || p.id !== editing.id).sort((a,b) => a.title.localeCompare(b.title, 'ko'))

  const renderItem = (item, isChildItem=false) => (
    <div key={item.id}
      style={{display:'flex',alignItems:'center',gap:14,padding:'10px 14px',
        background: isChildItem ? 'var(--color-nav-active-bg)' : undefined,
        borderTop: isChildItem ? '1px solid var(--color-border)' : undefined,
      }}>
      <div style={{width:40,height:40,borderRadius:7,overflow:'hidden',flexShrink:0,
        background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',
        justifyContent:'center',border:'1px solid var(--color-border)'}}>
        {item.cover_image_url
          ? <img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          : <span style={{fontSize:'1.1rem',opacity:0.35}}><Mi size="lg" color="light">description</Mi></span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:isChildItem?'0.85rem':'0.9rem',marginBottom:3,display:'flex',alignItems:'center',gap:8}}>
          {item.title}
          <span className={`badge ${STATUS_MAP[item.status]?.badge||'badge-gray'}`} style={{fontSize:'0.65rem'}}>{STATUS_MAP[item.status]?.label}</span>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {item.system_name&&<span className="text-xs text-light"><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
          {item.author&&<span className="text-xs text-light"><Mi size='sm' color='light'>person</Mi> {item.author}</span>}
          {item.player_count&&<span className="text-xs text-light"><Mi size='sm' color='light'>group</Mi> {item.player_count}</span>}
        </div>
        {item.scenario_url&&<a href={item.scenario_url} target="_blank" rel="noreferrer" style={{fontSize:'0.7rem',color:'var(--color-primary)',marginTop:2,display:'block'}}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
        {item.memo&&<p className="text-xs text-light" style={{marginTop:2}}>{item.memo}</p>}
      </div>
      {!isChildItem && (
        <div className="flex gap-8" style={{flexShrink:0}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
          <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
        </div>
      )}
      {isChildItem && (
        <div className="flex gap-8" style={{flexShrink:0}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
          <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
        </div>
      )}
    </div>
  )

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>description</Mi>시나리오 목록</h1>
          <p className="page-subtitle">보유/위시 TRPG 시나리오 목록이예요 ({items.length}개)</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 시나리오 추가</button>
      </div>

      <div className="flex gap-8" style={{marginBottom:12,flexWrap:'wrap'}}>
        {['all','unplayed','played','gm_done','want'].map(s=>(
          <button key={s} className={`btn btn-sm ${statusFilter===s?'btn-primary':'btn-outline'}`} onClick={()=>setStatusFilter(s)}>
            {s==='all'?'전체':STATUS_MAP[s]?.label}
          </button>
        ))}
      </div>
      <div style={{marginBottom:16,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}}/>
        {search && <span className="text-xs text-light">({filteredParents.length}건)</span>}
        <button className={`btn btn-sm ${sortOrder==='asc'?'btn-primary':'btn-outline'}`}
          onClick={async()=>{ const next=sortOrder==='asc'?'desc':'asc'; setSortOrder(next); await supabase.from('profiles').update({scenario_sort_order:next}).eq('id',user.id) }}>
          가나다순 {sortOrder==='asc'?'↑':'↓'}
        </button>
      </div>

      {loading?<LoadingSpinner/>:filteredParents.length===0
        ?<EmptyState icon="description" title="시나리오가 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        :<>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {paged.map(item => {
            const children = childMap[item.id] || []
            const isOpen = !!expanded[item.id]
            return (
              <div key={item.id} className="card" style={{padding:0,overflow:'hidden'}}>
                {renderItem(item)}
                {children.length > 0 && (
                  <button style={{width:'100%',background:'none',border:'none',
                    borderTop:'1px solid var(--color-border)',
                    padding:'5px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,
                    color:'var(--color-text-light)',fontSize:'0.78rem'}}
                    onClick={()=>toggleExpand(item.id)}>
                    <Mi size='sm' color='light'>{isOpen?'expand_less':'expand_more'}</Mi>
                    {isOpen ? '접기' : `시나리오 ${children.length}개 보기`}
                  </button>
                )}
                {isOpen && (
                  <div style={{borderTop:'1px solid var(--color-border)'}}>
                    {children.map(c => renderItem(c, true))}
                  </div>
                )}
              </div>
            )
          })}
          </div>
          <Pagination total={filteredParents.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
        </>
      }

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'시나리오 수정':'시나리오 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" placeholder="어둠 속의 가면" value={form.title} onChange={set('title')}/></div>
        <div className="form-group" style={{marginBottom:8}}>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.85rem'}}>
            <input type="checkbox" checked={isChild} onChange={e=>{setIsChild(e.target.checked);if(!e.target.checked)setForm(f=>({...f,parent_id:null}))}}/>
            수록/후속 시나리오 (하위 항목 체크)
          </label>
        </div>
        {isChild && (
          <div className="form-group">
            <label className="form-label">시나리오집 선택</label>
            <select className="form-select" value={form.parent_id||''} onChange={e=>setForm(f=>({...f,parent_id:e.target.value||null}))}>
              <option value="">선택해주세요</option>
              {parentOptions.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
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
        <div className="form-group"><label className="form-label">표지 이미지 URL</label><input className="form-input" placeholder="https://..." value={form.cover_image_url||''} onChange={set('cover_image_url')}/></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:64}}/></div>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 시나리오를 삭제하시겠어요?"/>
    </div>
  )
}
