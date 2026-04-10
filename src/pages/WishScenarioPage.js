// src/pages/WishScenarioPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { wishScenariosApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, Pagination, TagManager } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { RuleSelect } from '../components/RuleSelect'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const BLANK = { title:'', parent_id:null, system_name:'', author:'', cover_image_url:'', player_count:'', format:'physical', status_tags:[], memo:'', purchase_date:'', scenario_url:'' }
const FORMAT_MAP = { physical:'실물', digital:'전자', both:'실물+전자' }
const DEFAULT_STATUS_TAGS = ['미구매', '구매 예정', '품절']

function SortableWrapper({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const dragHandle = (
    <div {...attributes} {...listeners}
      style={{ cursor:'grab', padding:'0 2px', color:'var(--color-border)', display:'flex', alignItems:'center', touchAction:'none', flexShrink:0 }}>
      <Mi size="sm">drag_indicator</Mi>
    </div>
  )
  return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition, opacity:isDragging?0.4:1 }}>
      {children(dragHandle)}
    </div>
  )
}

const cleanPayload = f => {
  const { id, user_id, created_at, status, ...rest } = f
  return { ...rest, purchase_date:f.purchase_date||null, parent_id:f.parent_id||null, status_tags:f.status_tags||[] }
}

export function WishScenarioPage() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('asc')
  const [isChild, setIsChild] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [parentSearchText, setParentSearchText] = useState('')
  const [showParentDrop, setShowParentDrop] = useState(false)
  const [statusTags, setStatusTags] = useState([])
  const [tagModal, setTagModal] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('wish_scenarios').select('*').eq('user_id', user.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }
  const loadStatusTags = async () => {
    const { data } = await supabase.from('wish_scenario_status_tags').select('*').eq('user_id', user.id).order('created_at')
    setStatusTags(data || [])
    return data || []
  }

  useEffect(() => {
    const init = async () => {
      load()
      const tags = await loadStatusTags()
      if (tags.length === 0) {
        await supabase.from('wish_scenario_status_tags').insert(
          DEFAULT_STATUS_TAGS.map(name => ({ user_id: user.id, name }))
        )
        await loadStatusTags()
      }
    }
    init()
  }, [user])
  useEffect(() => { if (profile?.wish_scenario_sort_order) setSortOrder(profile.wish_scenario_sort_order) }, [profile])

  const addStatusTag    = async (name) => { await supabase.from('wish_scenario_status_tags').insert({ user_id:user.id, name }); loadStatusTags() }
  const editStatusTag   = async (id, name) => { await supabase.from('wish_scenario_status_tags').update({ name }).eq('id', id); loadStatusTags() }
  const removeStatusTag = async id => {
    const tag = statusTags.find(t => t.id === id)
    if (!tag) return
    const { data: fresh } = await supabase.from('wish_scenarios').select('id, status_tags').eq('user_id', user.id)
    const affected = (fresh || []).filter(i => (i.status_tags||[]).includes(tag.name))
    if (affected.length > 0) {
      await Promise.all(affected.map(i =>
        supabase.from('wish_scenarios').update({ status_tags: (i.status_tags||[]).filter(t => t !== tag.name) }).eq('id', i.id)
      ))
    }
    await supabase.from('wish_scenario_status_tags').delete().eq('id', id)
    await loadStatusTags()
    await load()
  }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const toggleStatusTag = tag => setForm(f => ({
    ...f,
    status_tags: (f.status_tags||[]).includes(tag)
      ? (f.status_tags||[]).filter(t => t !== tag)
      : [...(f.status_tags||[]), tag]
  }))

  const openNew = () => { setEditing(null); setForm(BLANK); setIsChild(false); setParentSearchText(''); setModal(true) }
  const openEdit = item => {
    setEditing(item)
    setForm({ ...item, status_tags: item.status_tags || [] })
    setIsChild(!!item.parent_id)
    if (item.parent_id) {
      const parent = parents.find(p => p.id === item.parent_id)
      setParentSearchText(parent?.title || '')
    } else { setParentSearchText('') }
    setModal(true)
  }
  const save = async () => {
    if (!form.title) return
    if (!editing && items.length >= 3000) { alert('게시판의 최대 등록 갯수를 초과하여 저장할 수 없습니다. 위시 시나리오을(를) 정리해주세요.'); return }
    const parentId = isChild ? (form.parent_id||null) : null
    const payload = cleanPayload({...form, parent_id: parentId})
    if (editing) {
      await wishScenariosApi.update(editing.id, payload)
    } else {
      const so = parentId ? (childMap[parentId]?.length || 0) : undefined
      await wishScenariosApi.create({...payload, user_id:user.id, ...(so !== undefined ? {sort_order:so} : {})})
    }
    setModal(false); load()
  }
  const remove = async id => { await wishScenariosApi.remove(id); load() }
  const toggleExpand = id => setExpanded(e => ({...e, [id]:!e[id]}))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const activeItem = items.find(i => i.id === active.id)
    const overItem   = items.find(i => i.id === over.id)
    if (!activeItem || !overItem) return
    if (activeItem.parent_id && overItem.parent_id && activeItem.parent_id === overItem.parent_id) {
      const siblings = childMap[activeItem.parent_id] || []
      const oldIdx = siblings.findIndex(i => i.id === active.id)
      const newIdx = siblings.findIndex(i => i.id === over.id)
      const reordered = arrayMove(siblings, oldIdx, newIdx)
      setItems(prev => [...prev.filter(i => i.parent_id !== activeItem.parent_id), ...reordered])
      await Promise.all(reordered.map((item, idx) =>
        supabase.from('wish_scenarios').update({ sort_order: idx }).eq('id', item.id)
      ))
    }
  }

  const parents = useMemo(() => items.filter(i => !i.parent_id), [items])
  const childMap = useMemo(() => {
    const m = {}
    items.filter(i => i.parent_id).forEach(i => {
      if (!m[i.parent_id]) m[i.parent_id] = []
      m[i.parent_id].push(i)
    })
    return m
  }, [items])

  useEffect(() => {
    if (!search || !parents?.length) return
    const s = search.toLowerCase()
    const matchItem = i => !!(
      i.title?.toLowerCase().includes(s) || i.system_name?.toLowerCase().includes(s)
      || i.author?.toLowerCase().includes(s) || i.memo?.toLowerCase().includes(s)
    )
    const autoExpand = {}
    parents.forEach(p => { if (childMap[p.id]?.some(c => matchItem(c))) autoExpand[p.id] = true })
    setExpanded(prev => ({ ...prev, ...autoExpand }))
  }, [search, parents, childMap])

  const filteredParents = useMemo(() => {
    const s = search.toLowerCase()
    const matchItem = i => !s
      || i.title?.toLowerCase().includes(s) || i.system_name?.toLowerCase().includes(s)
      || i.author?.toLowerCase().includes(s) || i.memo?.toLowerCase().includes(s)

    return parents
      .filter(i => {
        const matchStatus = statusFilter === 'all' || (i.status_tags||[]).includes(statusFilter)
        const matchParent = matchItem(i)
        const matchChild  = childMap[i.id]?.some(c => matchItem(c))
        return matchStatus && (matchParent || matchChild)
      })
      .sort((a,b) => {
        const ta=a.title.toLowerCase(), tb=b.title.toLowerCase()
        return sortOrder==='asc' ? ta.localeCompare(tb,'ko') : tb.localeCompare(ta,'ko')
      })
  }, [parents, statusFilter, search, sortOrder, childMap])

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filteredParents, 20)
  const parentOptions = parents.filter(p => !editing || p.id !== editing.id).sort((a,b) => a.title.localeCompare(b.title, 'ko'))

  const renderItem = (item, isChildItem=false, dragHandle=null) => (
    <div key={item.id}
      style={{display:'flex',alignItems:'center',gap:isChildItem?8:10,
        padding: isChildItem ? '8px 14px 8px 14px' : '10px 14px',
        borderTop: isChildItem ? '1px solid var(--color-border)' : undefined,
        background: isChildItem ? 'var(--color-nav-active-bg)' : undefined,
      }}>
      {dragHandle}
      <div style={{width:40,height:40,borderRadius:7,overflow:'hidden',flexShrink:0,
        background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',
        justifyContent:'center',border:'1px solid var(--color-border)'}}>
        {item.cover_image_url
          ? <img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          : <span style={{fontSize:'1.1rem',opacity:0.35}}><Mi size="lg" color="light">description</Mi></span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight: isChildItem ? 500 : 700,fontSize:'0.9rem',marginBottom:3,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          {item.title}
          {(item.status_tags||[]).map(t => (
            <span key={t} style={{padding:'1px 7px',borderRadius:100,fontSize:'0.65rem',fontWeight:600,whiteSpace:'nowrap',
              background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)'}}>
              {t}
            </span>
          ))}
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {item.system_name&&<span className="text-xs text-light"><Mi size='sm' color='light'>sports_esports</Mi> {item.system_name}</span>}
          {item.author&&<span className="text-xs text-light"><Mi size='sm' color='light'>person</Mi> {item.author}</span>}
          {item.player_count&&<span className="text-xs text-light"><Mi size='sm' color='light'>group</Mi> {item.player_count}</span>}
          {item.format&&<span className="text-xs text-light"><Mi size='sm' color='light'>inventory_2</Mi> {FORMAT_MAP[item.format]||item.format}</span>}
        </div>
        {item.scenario_url&&<a href={item.scenario_url} target="_blank" rel="noreferrer" style={{fontSize:'0.7rem',color:'var(--color-primary)',marginTop:2,display:'block'}}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
        {item.memo&&<p className="text-xs text-light" style={{marginTop:2}}>{item.memo}</p>}
      </div>
      {!isChildItem && (
        <div className="flex gap-8" style={{flexShrink:0}}>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--color-primary)'}} title="수록 시나리오 추가"
            onClick={()=>{ setEditing(null); setForm({...BLANK, parent_id:item.id}); setIsChild(true); setParentSearchText(item.title); setModal(true) }}>
            <Mi size="sm">add</Mi>
          </button>
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
          <h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>favorite</Mi>위시 시나리오</h1>
          <p className="page-subtitle">갖고 싶은 TRPG 시나리오집 목록이예요 ({items.length}개)</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}><Mi size='sm'>sell</Mi> 상태 태그 관리</button>
          <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 시나리오 추가</button>
        </div>
      </div>

      {/* 상태 태그 필터 */}
      <div className="flex gap-8" style={{marginBottom:12,flexWrap:'wrap'}}>
        <button className={`btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setStatusFilter('all')}>전체</button>
        {statusTags.map(t => (
          <button key={t.id}
            className={`btn btn-sm ${statusFilter===t.name?'btn-primary':'btn-outline'}`}
            onClick={()=>setStatusFilter(t.name)}>
            {t.name}
          </button>
        ))}
      </div>

      <div style={{marginBottom:16,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}}/>
        {search && <span className="text-xs text-light">({filteredParents.length}건)</span>}
        <button className={`btn btn-sm ${sortOrder==='asc'?'btn-primary':'btn-outline'}`}
          onClick={async()=>{ const next=sortOrder==='asc'?'desc':'asc'; setSortOrder(next); await supabase.from('profiles').update({wish_scenario_sort_order:next}).eq('id',user.id) }}>
          가나다순 {sortOrder==='asc'?'↑':'↓'}
        </button>
      </div>

      {loading?<LoadingSpinner/>:filteredParents.length===0
        ?<EmptyState icon="favorite" title="위시 시나리오가 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        :<>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {paged.map(item => {
              const children = childMap[item.id] || []
              const isOpen = !!expanded[item.id]
              return (
                <div key={item.id} className="card" style={{padding:0,overflow:'hidden'}}>
                  {renderItem(item, false, null)}
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
                      <SortableContext items={children.map(c=>c.id)} strategy={verticalListSortingStrategy}>
                        {children.map(c => (
                          <SortableWrapper key={c.id} id={c.id}>
                            {childDragHandle => renderItem(c, true, childDragHandle)}
                          </SortableWrapper>
                        ))}
                      </SortableContext>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </DndContext>
          <Pagination total={filteredParents.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
        </>
      }

      {/* 추가/수정 모달 */}
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
          <div className="form-group" style={{position:'relative'}}>
            <label className="form-label">시나리오집 선택</label>
            <input
              className="form-input"
              placeholder="시나리오집 이름으로 검색..."
              value={parentSearchText}
              autoComplete="off"
              onChange={e=>{ setParentSearchText(e.target.value); setShowParentDrop(true); if(!e.target.value) setForm(f=>({...f,parent_id:null})) }}
              onFocus={()=>setShowParentDrop(true)}
              onBlur={()=>setTimeout(()=>setShowParentDrop(false),150)}
            />
            {form.parent_id && !showParentDrop && (
              <div className="text-xs text-light" style={{marginTop:4}}>
                선택됨: {parentOptions.find(p=>p.id===form.parent_id)?.title}
              </div>
            )}
            {showParentDrop && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,
                background:'var(--color-surface)',border:'1px solid var(--color-border)',
                borderRadius:8,maxHeight:180,overflowY:'auto',
                boxShadow:'0 4px 12px rgba(0,0,0,0.12)'}}>
                {parentOptions.filter(p=>!parentSearchText||p.title.toLowerCase().includes(parentSearchText.toLowerCase())).length===0
                  ? <div className="text-sm text-light" style={{padding:'10px 12px'}}>검색 결과 없음</div>
                  : parentOptions
                      .filter(p=>!parentSearchText||p.title.toLowerCase().includes(parentSearchText.toLowerCase()))
                      .map(p=>(
                        <div key={p.id}
                          style={{padding:'8px 12px',cursor:'pointer',fontSize:'0.88rem',
                            background:form.parent_id===p.id?'var(--color-nav-active-bg)':'transparent'}}
                          onMouseDown={()=>{ setForm(f=>({...f,parent_id:p.id})); setParentSearchText(p.title); setShowParentDrop(false) }}>
                          {p.title}
                        </div>
                      ))
                }
              </div>
            )}
          </div>
        )}
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
          <div className="form-group"><label className="form-label">라이터</label><input className="form-input" value={form.author||''} onChange={set('author')}/></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">인원</label><input className="form-input" placeholder="3~5인, 다인, 타이..." value={form.player_count||''} onChange={set('player_count')}/></div>
          <div className="form-group"><label className="form-label">형태</label>
            <select className="form-select" value={form.format||'physical'} onChange={set('format')}>
              <option value="physical">실물</option><option value="digital">전자</option><option value="both">실물+전자</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">
            상태
            <button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button>
          </label>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {statusTags.map(tag => {
              const isSelected = (form.status_tags||[]).includes(tag.name)
              return (
                <button key={tag.id} type="button"
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                  onClick={()=>toggleStatusTag(tag.name)}>
                  {tag.name}
                </button>
              )
            })}
            {statusTags.length === 0 && <span className="text-xs text-light">태그를 먼저 추가해주세요</span>}
          </div>
        </div>
        <div className="form-group"><label className="form-label">시나리오 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_url||''} onChange={set('scenario_url')}/></div>
        <div className="form-group"><label className="form-label">표지 이미지 URL</label><input className="form-input" placeholder="https://..." value={form.cover_image_url||''} onChange={set('cover_image_url')}/></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:64}}/></div>
      </Modal>

      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 상태 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      >
        <TagManager tags={statusTags} onAdd={addStatusTag} onEdit={editStatusTag} onRemove={removeStatusTag} placeholder="미구매, 구매 예정, 구매 완료..."/>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 시나리오를 삭제하시겠어요?"/>
    </div>
  )
}
