// src/pages/BookmarkPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { bookmarksApi, bookmarkTagsApi, fetchOgMeta } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'

const BLANK = { url:'', title:'', description:'', thumbnail_url:'', memo:'', tags:[] }

export function BookmarkPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [tags, setTags] = useState([])
  const [tagModal, setTagModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [fetching, setFetching] = useState(false)

  const load = async () => {
    const { data } = await bookmarksApi.getAll(user.id)
    setItems(data||[])
    setLoading(false)
  }
  const loadTags = async () => {
    const { data } = await bookmarkTagsApi.getAll(user.id)
    setTags(data||[])
  }
  useEffect(() => { load(); loadTags() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const toggleTag = tag => setForm(f => ({
    ...f, tags: f.tags?.includes(tag) ? f.tags.filter(t=>t!==tag) : [...(f.tags||[]), tag]
  }))

  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item, tags: item.tags||[]}); setModal(true) }

  // URL 입력 후 OG 메타 자동 가져오기
  const handleUrlBlur = async () => {
    if (!form.url || editing || form.title) return
    setFetching(true)
    const meta = await fetchOgMeta(form.url)
    setForm(f => ({
      ...f,
      title: meta.title || f.title,
      description: meta.description || f.description,
      thumbnail_url: meta.thumbnail_url || f.thumbnail_url,
    }))
    setFetching(false)
  }

  const refetchMeta = async () => {
    if (!form.url) return
    setFetching(true)
    const meta = await fetchOgMeta(form.url)
    setForm(f => ({...f, title: meta.title||f.title, description: meta.description||f.description, thumbnail_url: meta.thumbnail_url||f.thumbnail_url}))
    setFetching(false)
  }

  const save = async () => {
    if (!form.url) return
    if (editing) await bookmarksApi.update(editing.id, form)
    else await bookmarksApi.create({...form, user_id: user.id})
    setModal(false); load()
  }

  const addTag = async () => {
    if (!newTag.trim()) return
    await bookmarkTagsApi.create({user_id: user.id, name: newTag.trim()})
    setNewTag(''); loadTags()
  }
  const removeTag = async (id) => { await bookmarkTagsApi.remove(id); loadTags() }

  const filtered = useMemo(() => items.filter(i => {
    const matchSearch = !search || i.title?.includes(search) || i.url?.includes(search) || i.memo?.includes(search)
    const matchTag = tagFilter==='all' || i.tags?.includes(tagFilter)
    return matchSearch && matchTag
  }), [items, search, tagFilter])

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">🔖 북마크</h1>
          <p className="page-subtitle">유용한 링크와 배포 자료들을 모아요</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}>🏷️ 태그 관리</button>
          <button className="btn btn-primary" onClick={openNew}>+ 북마크 추가</button>
        </div>
      </div>

      {/* 검색 + 태그 필터 */}
      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 제목, URL, 메모로 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:320, marginBottom: tags.length>0?10:0}} />
        {tags.length > 0 && (
          <div className="flex gap-8" style={{flexWrap:'wrap', marginTop:8}}>
            <button className={`btn btn-sm ${tagFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setTagFilter('all')}>전체</button>
            {tags.map(t=>(
              <button key={t.id} className={`btn btn-sm ${tagFilter===t.name?'btn-primary':'btn-outline'}`} onClick={()=>setTagFilter(t.name)}>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner /> : filtered.length===0
        ? <EmptyState icon="🔖" title="북마크가 없어요" description="유용한 링크를 추가해보세요!" action={<button className="btn btn-primary" onClick={openNew}>북마크 추가</button>} />
        : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:14}}>
            {filtered.map(item=>(
              <div key={item.id}
                style={{borderRadius:12, overflow:'hidden', background:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'0 2px 12px var(--color-shadow)', display:'flex', flexDirection:'column', transition:'transform 0.15s, box-shadow 0.15s', cursor:'pointer'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
                onClick={()=>window.open(item.url,'_blank')}
              >
                {/* 썸네일 */}
                <div style={{height:130, background:'var(--color-nav-active-bg)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
                  {item.thumbnail_url
                    ? <img src={item.thumbnail_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}
                        onError={e=>{e.target.style.display='none'}} />
                    : <span style={{fontSize:'3rem',opacity:0.2}}>🔗</span>
                  }
                  {/* 태그 칩 */}
                  {item.tags?.length > 0 && (
                    <div style={{position:'absolute',bottom:8,left:8,right:8,display:'flex',gap:4,flexWrap:'wrap'}}>
                      {item.tags.map(tag=>(
                        <span key={tag} style={{padding:'2px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:700,background:'rgba(200,169,110,0.25)',color:'#7a5c30',border:'1px solid rgba(200,169,110,0.5)',backdropFilter:'blur(4px)'}}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div style={{padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:4}}>
                  <div style={{fontWeight:700, fontSize:'0.88rem', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                    {item.title || item.url}
                  </div>
                  {item.description && (
                    <div style={{fontSize:'0.72rem', color:'var(--color-text-light)', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                      {item.description}
                    </div>
                  )}
                  <div style={{fontSize:'0.65rem', color:'var(--color-text-light)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'auto', paddingTop:4}}>
                    🌐 {item.url}
                  </div>
                  {item.memo && (
                    <div style={{fontSize:'0.72rem', color:'var(--color-accent)', padding:'5px 8px', borderRadius:6, background:'var(--color-nav-active-bg)', marginTop:4}}>
                      📝 {item.memo}
                    </div>
                  )}
                </div>

                {/* 액션 */}
                <div style={{padding:'6px 12px 10px', display:'flex', gap:6, justifyContent:'flex-end', borderTop:'1px solid var(--color-border)'}} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* 북마크 추가/수정 모달 */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'북마크 수정':'북마크 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        {/* URL 입력 */}
        <div className="form-group">
          <label className="form-label">URL *</label>
          <div style={{display:'flex', gap:8}}>
            <input className="form-input" placeholder="https://..." value={form.url} onChange={set('url')} onBlur={handleUrlBlur} style={{flex:1}} />
            <button type="button" className="btn btn-outline btn-sm" onClick={refetchMeta} disabled={fetching} style={{whiteSpace:'nowrap', flexShrink:0}}>
              {fetching ? '로딩...' : '🔄 정보 가져오기'}
            </button>
          </div>
          {fetching && <div className="text-xs text-light" style={{marginTop:4}}>링크 정보를 불러오는 중...</div>}
        </div>

        {/* 썸네일 미리보기 */}
        {form.thumbnail_url && (
          <div style={{marginBottom:12, borderRadius:8, overflow:'hidden', height:100, background:'var(--color-nav-active-bg)'}}>
            <img src={form.thumbnail_url} alt="thumbnail" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'}} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">제목</label>
          <input className="form-input" placeholder="자동으로 가져와요" value={form.title||''} onChange={set('title')} />
        </div>

        <div className="form-group">
          <label className="form-label">썸네일 이미지 URL</label>
          <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.thumbnail_url||''} onChange={set('thumbnail_url')} />
        </div>

        {/* 태그 선택 */}
        <div className="form-group">
          <label className="form-label">태그
            <button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button>
          </label>
          {tags.length===0
            ? <div className="text-xs text-light">태그가 없어요. "태그 관리"에서 추가해주세요!</div>
            : <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {tags.map(tag=>(
                  <button key={tag.id} type="button"
                    className={`btn btn-sm ${form.tags?.includes(tag.name)?'btn-primary':'btn-outline'}`}
                    onClick={()=>toggleTag(tag.name)}
                  >{tag.name}</button>
                ))}
              </div>
          }
        </div>

        <div className="form-group">
          <label className="form-label">메모</label>
          <textarea className="form-textarea" placeholder="간단한 메모..." value={form.memo||''} onChange={set('memo')} style={{minHeight:64}} />
        </div>
      </Modal>

      {/* 태그 관리 모달 */}
      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 북마크 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      >
        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <input className="form-input" placeholder="도토리, 배포자료, 유틸, 시나리오..." value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} style={{flex:1}} />
          <button className="btn btn-primary btn-sm" onClick={addTag}>추가</button>
        </div>
        {tags.length===0
          ? <div className="text-sm text-light" style={{textAlign:'center', padding:'16px 0'}}>아직 태그가 없어요</div>
          : <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {tags.map(tag=>(
                <div key={tag.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:8, background:'var(--color-nav-active-bg)', border:'1px solid var(--color-border)'}}>
                  <span style={{fontSize:'0.88rem'}}>{tag.name}</span>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373', padding:'2px 8px'}} onClick={()=>removeTag(tag.id)}>삭제</button>
                </div>
              ))}
            </div>
        }
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>{ bookmarksApi.remove(confirm); load(); setConfirm(null) }} message="이 북마크를 삭제하시겠어요?" />
    </div>
  )
}
