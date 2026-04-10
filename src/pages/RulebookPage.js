// src/pages/RulebookPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { rulebooksApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { useRules } from '../context/RuleContext'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const BLANK = { title:'', publisher:'', system_name:'', cover_image_url:'', memo:'', tags:[], parent_id:null, color:'' }
const COLOR_PALETTE = ['#e74c3c','#e67e22','#f1c40f','#27ae60','#1abc9c','#3498db','#2980b9','#9b59b6','#e91e63','#795548','#607d8b','#95a5a6']

function DragHandle({ listeners, attributes }) {
  return (
    <div {...attributes} {...listeners}
      style={{ cursor:'grab', padding:'0 2px', color:'var(--color-border)', display:'flex', alignItems:'center', touchAction:'none', flexShrink:0 }}
      title="드래그하여 순서 변경">
      <Mi size="sm">drag_indicator</Mi>
    </div>
  )
}

function SortableSupplRow({ item, availableTags, onEdit, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition, opacity:isDragging?0.4:1, zIndex:isDragging?10:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px 8px 14px', borderTop:'1px solid var(--color-border)', background:'var(--color-nav-active-bg)' }}>
        <DragHandle listeners={listeners} attributes={attributes}/>
        <div style={{ width:36, height:36, borderRadius:7, overflow:'hidden', flexShrink:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {item.cover_image_url
            ? <img src={item.cover_image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <span style={{ fontSize:'1rem', opacity:0.35 }}><Mi size="sm" color="light">menu_book</Mi></span>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:500, fontSize:'0.88rem', marginBottom:2, display:'flex', alignItems:'center', gap:6 }}>
            {item.color && <span style={{ width:7, height:7, borderRadius:'50%', background:item.color, flexShrink:0, display:'inline-block' }}/>}
            {item.title}
            {item.publisher && <span className="text-xs text-light" style={{ fontWeight:400 }}>{item.publisher}</span>}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {item.tags?.filter(t => availableTags.some(at => at.name === t)).map(t =>
              <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>
            )}
          </div>
          {item.memo && <p className="text-xs text-light" style={{ marginTop:2 }}>{item.memo}</p>}
        </div>
        <div className="flex gap-8" style={{ flexShrink:0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>수정</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#e57373' }} onClick={() => onRemove(item.id)}>삭제</button>
        </div>
      </div>
    </div>
  )
}

function SortableRulebookCard({ item, suppls, isOpen, availableTags, onToggle, onEdit, onAddSuppl, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition, opacity:isDragging?0.4:1, zIndex:isDragging?10:'auto' }}>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px' }}>
          <DragHandle listeners={listeners} attributes={attributes}/>
          <button onClick={() => suppls.length > 0 && onToggle(item.id)}
            style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', border:'none', cursor:suppls.length > 0 ? 'pointer' : 'default', position:'relative' }}>
            {item.cover_image_url
              ? <img src={item.cover_image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:'1.2rem', opacity:0.35 }}><Mi size="lg" color="light">menu_book</Mi></span>}
            {suppls.length > 0 && (
              <div style={{ position:'absolute', bottom:0, right:0, background:'var(--color-primary)', borderRadius:'4px 0 7px 0', padding:'1px 4px', fontSize:'0.55rem', color:'white', fontWeight:700 }}>
                {suppls.length}
              </div>
            )}
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:8 }}>
              {item.color && <span style={{ width:8, height:8, borderRadius:'50%', background:item.color, flexShrink:0, display:'inline-block' }}/>}
              {item.title}
              {item.publisher && <span className="text-xs text-light" style={{ fontWeight:400 }}>{item.publisher}</span>}
              {suppls.length > 0 && (
                <button onClick={() => onToggle(item.id)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'var(--color-text-light)', display:'flex', alignItems:'center' }}>
                  <Mi size="sm" color="light">{isOpen ? 'expand_less' : 'expand_more'}</Mi>
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {item.tags?.filter(t => availableTags.some(at => at.name === t)).map(t =>
                <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>
              )}
            </div>
            {item.memo && <p className="text-xs text-light" style={{ marginTop:3 }}>{item.memo}</p>}
          </div>
          <div className="flex gap-8" style={{ flexShrink:0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onAddSuppl(item.id)} title="서플리먼트 추가" style={{ color:'var(--color-primary)' }}><Mi size="sm">add</Mi></button>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>수정</button>
            <button className="btn btn-ghost btn-sm" style={{ color:'#e57373' }} onClick={() => onRemove(item.id)}>삭제</button>
          </div>
        </div>
        {isOpen && suppls.length > 0 && (
          <div style={{ borderTop:'1px solid var(--color-border)' }}>
            <SortableContext items={suppls.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {suppls.map(s => (
                <SortableSupplRow key={s.id} item={s} availableTags={availableTags}
                  onEdit={onEdit} onRemove={onRemove}/>
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  )
}
const DEFAULT_TAG_NAMES = ['GM','주력','미숙','관심','초보','입문','미입문']

export function RulebookPage() {
  const { user } = useAuth()
  const { reload: reloadRules } = useRules()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [isSuppl, setIsSuppl] = useState(false)   // 서플리먼트 체크박스
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [tagModal, setTagModal] = useState(false)
  const [availableTags, setAvailableTags] = useState([])
  const [expanded, setExpanded] = useState({})   // 아코디언 열림 상태

  const load = async () => {
    const { data } = await supabase.from('rulebooks').select('*').eq('user_id', user.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }
  const loadTags = async () => {
    const { data } = await supabase.from('rulebook_tags').select('*').eq('user_id', user.id).order('name')
    setAvailableTags(data || [])
  }
  useEffect(() => {
    const init = async () => {
      load()
      const { data } = await supabase.from('rulebook_tags').select('*').eq('user_id', user.id).order('name')
      if (data && data.length === 0) {
        await supabase.from('rulebook_tags').insert(DEFAULT_TAG_NAMES.map(name => ({ user_id:user.id, name })))
        const { data:d2 } = await supabase.from('rulebook_tags').select('*').eq('user_id', user.id).order('name')
        setAvailableTags(d2 || [])
      } else {
        setAvailableTags(data || [])
      }
    }
    init()
  }, [user])

  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))
  const toggleTag = tag => setForm(f => ({ ...f, tags:f.tags?.includes(tag) ? f.tags.filter(t=>t!==tag) : [...(f.tags||[]), tag] }))

  const openNew = () => {
    setEditing(null)
    setForm(BLANK)
    setIsSuppl(false)
    setModal(true)
  }
  const openEdit = item => {
    setEditing(item)
    setForm({ ...item, tags:item.tags||[], parent_id:item.parent_id||null })
    setIsSuppl(!!item.parent_id)
    setModal(true)
  }

  const save = async () => {
    if (!form.title) return
    if (!editing && items.length >= 3000) { alert('게시판의 최대 등록 갯수를 초과하여 저장할 수 없습니다. 보유 룰북을 정리해주세요.'); return }
    const { id, user_id, created_at, ...formFields } = form
    const payload = { ...formFields, parent_id: isSuppl ? (form.parent_id || null) : null }
    if (editing) await supabase.from('rulebooks').update(payload).eq('id', editing.id)
    else await supabase.from('rulebooks').insert({ ...payload, user_id:user.id })
    setModal(false)
    load()
    reloadRules() // 다른 페이지의 룰 선택 즉시 갱신
  }
  const remove = async id => {
    // 서플리먼트도 같이 삭제 (ON DELETE CASCADE 없으면 수동 처리)
    await supabase.from('rulebooks').delete().eq('parent_id', id)
    await supabase.from('rulebooks').delete().eq('id', id)
    load()
  }


  const addTag = async name => { await supabase.from('rulebook_tags').insert({ user_id:user.id, name }); loadTags() }
  const editTag = async (id, name) => { await supabase.from('rulebook_tags').update({ name }).eq('id', id); loadTags() }
  const removeTagDef = async id => {
    const tag = availableTags.find(t => t.id === id)
    if (!tag) return
    // items 상태 대신 DB에서 직접 최신 데이터를 읽어 stale state 문제 방지
    const { data: freshItems } = await supabase.from('rulebooks').select('id, tags').eq('user_id', user.id)
    const affected = (freshItems || []).filter(i => i.tags?.includes(tag.name))
    if (affected.length > 0) {
      await Promise.all(
        affected.map(i =>
          supabase.from('rulebooks').update({ tags: i.tags.filter(t => t !== tag.name) }).eq('id', i.id)
        )
      )
    }
    await supabase.from('rulebook_tags').delete().eq('id', id)
    await loadTags()
    await load()
  }

  const toggleExpand = id => setExpanded(e => ({ ...e, [id]:!e[id] }))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const activeItem = items.find(i => i.id === active.id)
    const overItem   = items.find(i => i.id === over.id)
    if (!activeItem || !overItem) return

    if (!activeItem.parent_id && !overItem.parent_id) {
      // 부모 간 정렬
      const oldIdx = parents.findIndex(i => i.id === active.id)
      const newIdx = parents.findIndex(i => i.id === over.id)
      const reordered = arrayMove(parents, oldIdx, newIdx)
      setItems(prev => {
        const children = prev.filter(i => i.parent_id)
        return [...reordered, ...children]
      })
      await Promise.all(reordered.map((item, idx) =>
        supabase.from('rulebooks').update({ sort_order: idx }).eq('id', item.id)
      ))
    } else if (activeItem.parent_id && overItem.parent_id && activeItem.parent_id === overItem.parent_id) {
      // 같은 부모 내 자식 정렬
      const siblings = supplMap[activeItem.parent_id] || []
      const oldIdx = siblings.findIndex(i => i.id === active.id)
      const newIdx = siblings.findIndex(i => i.id === over.id)
      const reordered = arrayMove(siblings, oldIdx, newIdx)
      setItems(prev => {
        const others = prev.filter(i => i.parent_id !== activeItem.parent_id)
        return [...others, ...reordered]
      })
      await Promise.all(reordered.map((item, idx) =>
        supabase.from('rulebooks').update({ sort_order: idx }).eq('id', item.id)
      ))
    }
  }

  // 부모/서플 분리
  const parents = useMemo(() => items.filter(i => !i.parent_id), [items])
  const supplMap = useMemo(() => {
    const m = {}
    items.filter(i => i.parent_id).forEach(i => {
      if (!m[i.parent_id]) m[i.parent_id] = []
      m[i.parent_id].push(i)
    })
    return m
  }, [items])

  const filteredParents = parents.filter(i =>
    !search || i.title.includes(search) || i.publisher?.includes(search) ||
    supplMap[i.id]?.some(s => s.title.includes(search) || s.publisher?.includes(search))
  )

  const { paged: pagedRulebooks, page: rbPage, setPage: setRbPage, perPage: rbPerPage, setPerPage: setRbPerPage } = usePagination(filteredParents, 20)

  // 부모 룰북 목록 (서플 선택용)
  const parentOptions = parents

  const RulebookRow = ({ item, isChild = false }) => (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding: isChild ? '8px 14px 8px 56px' : '10px 14px',
      background: isChild ? 'var(--color-nav-active-bg)' : 'var(--color-surface)',
      borderTop: isChild ? '1px solid var(--color-border)' : 'none',
    }}>
      <div style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0, background:'var(--color-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {item.cover_image_url
          ? <img src={item.cover_image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <span style={{ fontSize:'1.2rem', opacity:0.35 }}><Mi size="lg" color="light">menu_book</Mi></span>
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight: isChild ? 500 : 700, fontSize:'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:6 }}>
          {item.color && <span style={{width:8,height:8,borderRadius:'50%',background:item.color,flexShrink:0,display:'inline-block'}}/>}
          {item.title}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          
          {item.tags?.filter(t => availableTags.some(at => at.name === t)).map(t => <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>)}
        </div>
        {item.memo && <p className="text-xs text-light" style={{ marginTop:3 }}>{item.memo}</p>}
      </div>
      <div className="flex gap-8" style={{ flexShrink:0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>수정</button>
        <button className="btn btn-ghost btn-sm" style={{ color:'#e57373' }} onClick={() => setConfirm(item.id)}>삭제</button>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{ marginRight:8, verticalAlign:'middle' }}>menu_book</Mi>보유 룰북</h1><p className="page-subtitle">보유한 TRPG 룰북 목록이에요 ({parents.length}권 / 서플 {items.length - parents.length}권)</p></div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={() => setTagModal(true)}><Mi size='sm'>sell</Mi> 태그 관리</button>
          <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 룰북 추가</button>
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth:280 }}/>
      </div>

      {loading ? <LoadingSpinner/> : filteredParents.length === 0
        ? <EmptyState icon="menu_book" title="룰북이 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        : <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pagedRulebooks.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {pagedRulebooks.map(item => (
                  <SortableRulebookCard
                    key={item.id}
                    item={item}
                    suppls={supplMap[item.id] || []}
                    isOpen={!!expanded[item.id]}
                    availableTags={availableTags}
                    onToggle={toggleExpand}
                    onEdit={openEdit}
                    onAddSuppl={parentId => { setEditing(null); setForm({ ...BLANK, parent_id:parentId }); setIsSuppl(true); setModal(true) }}
                    onRemove={id => setConfirm(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Pagination total={filteredParents.length} perPage={rbPerPage} page={rbPage} onPage={setRbPage} onPerPage={setRbPerPage}/>
        </>
      }

      {/* 추가/수정 모달 */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? '룰북 수정' : '룰북 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={() => setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        {/* 서플리먼트 체크박스 */}
        <div className="form-group">
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
            <input type="checkbox" checked={isSuppl} onChange={e => { setIsSuppl(e.target.checked); if (!e.target.checked) setForm(f => ({ ...f, parent_id:null })) }}
              style={{ width:16, height:16, accentColor:'var(--color-primary)', cursor:'pointer' }}/>
            <span style={{ fontSize:'0.88rem', fontWeight:600 }}>서플리먼트 (다른 룰북의 하위 항목)</span>
          </label>
        </div>

        {/* 부모 선택 (서플일 때만) */}
        {isSuppl && (
          <div className="form-group">
            <label className="form-label">부모 룰북 *</label>
            <select className="form-select" value={form.parent_id || ''} onChange={e => setForm(f => ({ ...f, parent_id:e.target.value || null }))}>
              <option value="">선택하세요</option>
              {parentOptions.filter(p => !editing || p.id !== editing.id).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" value={form.title} onChange={set('title')}/></div>
        <div className="form-group"><label className="form-label">출판사</label><input className="form-input" placeholder="예: KADOKAWA, 아크라이트, 스튜디오 아발론..." value={form.publisher||''} onChange={set('publisher')} autoComplete="off"/></div>
        <div className="form-group">
          <label className="form-label">컬러 <span className="text-xs text-light">(일정 월뷰에 표시)</span></label>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <button type="button" title="없음"
              style={{width:26,height:26,borderRadius:'50%',border: !form.color ? '3px solid var(--color-accent)' : '2px solid var(--color-border)',background:'var(--color-surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
              onClick={()=>setForm(f=>({...f,color:''}))}>
              <Mi size="sm" color="light">block</Mi>
            </button>
            {COLOR_PALETTE.map(c=>(
              <button key={c} type="button"
                style={{width:26,height:26,borderRadius:'50%',border: form.color===c ? '3px solid var(--color-accent)' : '2px solid transparent',background:c,cursor:'pointer',flexShrink:0}}
                onClick={()=>setForm(f=>({...f,color:c}))}/>
            ))}
            <input type="color" value={form.color||'#888888'}
              onChange={e=>setForm(f=>({...f,color:e.target.value}))}
              style={{width:26,height:26,padding:2,borderRadius:'50%',border:'2px solid var(--color-border)',cursor:'pointer',background:'none'}}
              title="직접 선택"/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">태그<button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft:8, fontSize:'0.68rem' }} onClick={() => setTagModal(true)}>+ 태그 관리</button></label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {availableTags.map(tag => <button key={tag.id} type="button" className={`btn btn-sm ${form.tags?.includes(tag.name) ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleTag(tag.name)}>{tag.name}</button>)}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">아이콘 이미지</label>
          <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.cover_image_url||''} onChange={set('cover_image_url')}/>
          {form.cover_image_url && <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}><img src={form.cover_image_url} alt="preview" style={{ width:48, height:48, objectFit:'cover', borderRadius:6, border:'1px solid var(--color-border)' }}/><button className="btn btn-ghost btn-sm" style={{ color:'#e57373' }} onClick={() => setForm(f => ({ ...f, cover_image_url:'' }))}>제거</button></div>}
        </div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{ minHeight:64 }}/></div>
      </Modal>

      <Modal isOpen={tagModal} onClose={() => setTagModal(false)} title="🏷️ 룰북 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={() => setTagModal(false)}>닫기</button>}
      >
        <TagManager tags={availableTags} onAdd={addTag} onEdit={editTag} onRemove={removeTagDef} placeholder="GM, 주력, 관심, 입문..."/>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => remove(confirm)} message="이 룰북을 삭제하시겠어요? 서플리먼트도 함께 삭제돼요."/>
    </div>
  )
}
