// src/pages/RulebookPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { rulebooksApi, uploadFile, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'

const BLANK = { title:'', system_name:'', cover_image_url:'', memo:'', tags:[], parent_id:null }
const DEFAULT_TAG_NAMES = ['GM','주력','미숙','관심','초보','입문','미입문']

export function RulebookPage() {
  const { user } = useAuth()
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
  const [imgUploading, setImgUploading] = useState(false)
  const [expanded, setExpanded] = useState({})   // 아코디언 열림 상태

  const load = async () => {
    const { data } = await supabase.from('rulebooks').select('*').eq('user_id', user.id).order('title')
    setItems(data || [])
    setLoading(false)
  }
  const loadTags = async () => {
    const { data } = await supabase.from('rulebook_tags').select('*').eq('user_id', user.id).order('name')
    if (data && data.length === 0) {
      await supabase.from('rulebook_tags').insert(DEFAULT_TAG_NAMES.map(name => ({ user_id:user.id, name })))
      const { data:d2 } = await supabase.from('rulebook_tags').select('*').eq('user_id', user.id).order('name')
      setAvailableTags(d2 || [])
    } else setAvailableTags(data || [])
  }
  useEffect(() => { load(); loadTags() }, [user])

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
    const payload = { ...form, parent_id: isSuppl ? (form.parent_id || null) : null }
    if (editing) await supabase.from('rulebooks').update(payload).eq('id', editing.id)
    else await supabase.from('rulebooks').insert({ ...payload, user_id:user.id })
    setModal(false)
    load()
  }
  const remove = async id => {
    // 서플리먼트도 같이 삭제 (ON DELETE CASCADE 없으면 수동 처리)
    await supabase.from('rulebooks').delete().eq('parent_id', id)
    await supabase.from('rulebooks').delete().eq('id', id)
    load()
  }

  const handleImgUpload = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setImgUploading(true)
    const { url, error } = await uploadFile('covers', `${user.id}/rulebook-${Date.now()}`, file)
    if (url) setForm(f => ({ ...f, cover_image_url:url }))
    else alert(error?.message || '업로드 실패')
    setImgUploading(false)
  }

  const addTag = async name => { await supabase.from('rulebook_tags').insert({ user_id:user.id, name }); loadTags() }
  const editTag = async (id, name) => { await supabase.from('rulebook_tags').update({ name }).eq('id', id); loadTags() }
  const removeTagDef = async id => { await supabase.from('rulebook_tags').delete().eq('id', id); loadTags() }

  const toggleExpand = id => setExpanded(e => ({ ...e, [id]:!e[id] }))

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
    !search || i.title.includes(search) ||
    supplMap[i.id]?.some(s => s.title.includes(search))
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
          {isChild && <span style={{ fontSize:'0.65rem', color:'var(--color-text-light)', opacity:0.7 }}>└</span>}
          {item.title}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          
          {item.tags?.map(t => <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>)}
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
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pagedRulebooks.map(item => {
              const suppls = supplMap[item.id] || []
              const isOpen = expanded[item.id]
              return (
                <div key={item.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                  {/* 부모 행 */}
                  <div style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 14px' }}>
                    {/* 서플 토글 버튼 */}
                    <button
                      onClick={() => suppls.length > 0 && toggleExpand(item.id)}
                      style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', border:'none', cursor: suppls.length > 0 ? 'pointer' : 'default', position:'relative' }}
                    >
                      {item.cover_image_url
                        ? <img src={item.cover_image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <span style={{ fontSize:'1.2rem', opacity:0.35 }}><Mi size="lg" color="light">menu_book</Mi></span>
                      }
                      {suppls.length > 0 && (
                        <div style={{ position:'absolute', bottom:0, right:0, background:'var(--color-primary)', borderRadius:'4px 0 7px 0', padding:'1px 4px', fontSize:'0.55rem', color:'white', fontWeight:700 }}>
                          {suppls.length}
                        </div>
                      )}
                    </button>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:8 }}>
                        {item.title}
                        {suppls.length > 0 && (
                          <button onClick={() => toggleExpand(item.id)}
                            style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'var(--color-text-light)', display:'flex', alignItems:'center' }}>
                            <Mi size="sm" color="light">{isOpen ? 'expand_less' : 'expand_more'}</Mi>
                          </button>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        
                        {item.tags?.map(t => <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>)}
                      </div>
                      {item.memo && <p className="text-xs text-light" style={{ marginTop:3 }}>{item.memo}</p>}
                    </div>
                    <div className="flex gap-8" style={{ flexShrink:0 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        // 서플리먼트 빠르게 추가
                        setEditing(null)
                        setForm({ ...BLANK, parent_id:item.id })
                        setIsSuppl(true)
                        setModal(true)
                      }} title="서플리먼트 추가" style={{ color:'var(--color-primary)' }}>
                        <Mi size="sm">add</Mi>
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>수정</button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'#e57373' }} onClick={() => setConfirm(item.id)}>삭제</button>
                    </div>
                  </div>

                  {/* 서플리먼트 아코디언 */}
                  {isOpen && suppls.length > 0 && (
                    <div style={{ borderTop:'1px solid var(--color-border)' }}>
                      {suppls.map(s => <RulebookRow key={s.id} item={s} isChild={true}/>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
        <div className="form-group">
          <label className="form-label">태그<button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft:8, fontSize:'0.68rem' }} onClick={() => setTagModal(true)}>+ 태그 관리</button></label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {availableTags.map(tag => <button key={tag.id} type="button" className={`btn btn-sm ${form.tags?.includes(tag.name) ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleTag(tag.name)}>{tag.name}</button>)}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">아이콘 이미지</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.cover_image_url||''} onChange={set('cover_image_url')} style={{ flex:1 }}/>
            <label className="btn btn-outline btn-sm" style={{ cursor:'pointer', whiteSpace:'nowrap' }}>{imgUploading ? '업로드 중...' : '📁 업로드'}<input type="file" accept="image/*" style={{ display:'none' }} onChange={handleImgUpload} disabled={imgUploading}/></label>
          </div>
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
