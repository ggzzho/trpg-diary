// src/pages/BookmarkPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { bookmarksApi, bookmarkTagsApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'

const BLANK = { url:'', title:'', description:'', thumbnail_url:'', memo:'', tags:[] }

// microlink.io API - 트위터/X, 일반 사이트 모두 지원
async function fetchOgMeta(url) {
  try {
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false`,
      { signal: AbortSignal.timeout(10000) }
    )
    const json = await res.json()
    if (json.status === 'success' && json.data) {
      const d = json.data
      return {
        title: d.title || '',
        description: d.description || '',
        thumbnail_url: d.image?.url || d.logo?.url || '',
      }
    }
  } catch {}

  // 폴백: allorigins
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const json = await res.json()
    const html = json.contents || ''
    if (html) {
      const getMeta = (prop) => {
        const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
                 || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))
        return m ? m[1] : null
      }
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = getMeta('og:title') || (titleMatch?titleMatch[1].trim():'') || ''
      const thumbnail_url = getMeta('og:image') || ''
      const description = getMeta('og:description') || getMeta('description') || ''
      if (title || thumbnail_url) return { title, description, thumbnail_url }
    }
  } catch {}

  return { title: '', description: '', thumbnail_url: '' }
}

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
  const [tagFilter, setTagFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')

  const load = async () => { const {data}=await bookmarksApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  const loadTags = async () => { const {data}=await bookmarkTagsApi.getAll(user.id); setTags(data||[]) }
  useEffect(() => { load(); loadTags() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const toggleTag = tag => setForm(f=>({...f,tags:f.tags?.includes(tag)?f.tags.filter(t=>t!==tag):[...(f.tags||[]),tag]}))

  const openNew = () => { setEditing(null); setForm(BLANK); setFetchMsg(''); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item,tags:item.tags||[]}); setFetchMsg(''); setModal(true) }

  const doFetch = async () => {
    if (!form.url) return
    setFetching(true); setFetchMsg('정보를 가져오는 중...')
    const meta = await fetchOgMeta(form.url)
    if (meta.title || meta.thumbnail_url) {
      setForm(f=>({...f, title:meta.title||f.title, description:meta.description||f.description, thumbnail_url:meta.thumbnail_url||f.thumbnail_url}))
      setFetchMsg('✅ 정보를 가져왔어요!')
    } else {
      setFetchMsg('⚠️ 자동으로 가져오지 못했어요. 직접 입력해주세요.')
    }
    setFetching(false)
    setTimeout(()=>setFetchMsg(''), 4000)
  }

  const handleUrlBlur = async () => {
    if (!form.url || editing || form.title) return
    doFetch()
  }

  const save = async () => {
    if (!form.url) return
    const validTagNames = tags.map(t=>t.name)
    const payload = {...form, tags:(form.tags||[]).filter(t=>validTagNames.includes(t))}
    if (editing) await bookmarksApi.update(editing.id, payload)
    else await bookmarksApi.create({...payload,user_id:user.id})
    setModal(false); load()
  }

  const addTag = async name => { await bookmarkTagsApi.create({user_id:user.id,name}); loadTags() }
  const editTag = async (id,name) => {
    const oldTag=tags.find(t=>t.id===id)?.name
    if (oldTag) { const affected=items.filter(i=>i.tags?.includes(oldTag)); for(const item of affected) await bookmarksApi.update(item.id,{...item,tags:item.tags.map(t=>t===oldTag?name:t)}) }
    await bookmarkTagsApi.remove(id); await bookmarkTagsApi.create({user_id:user.id,name}); load(); loadTags()
  }
  const removeTag = async id => {
    const tagName=tags.find(t=>t.id===id)?.name
    if (tagName) { const affected=items.filter(i=>i.tags?.includes(tagName)); for(const item of affected) await bookmarksApi.update(item.id,{...item,tags:item.tags.filter(t=>t!==tagName)}) }
    await bookmarkTagsApi.remove(id); load(); loadTags()
  }

  const filtered = useMemo(()=>items.filter(i=>{
    const ms=!search||i.title?.includes(search)||i.url?.includes(search)||i.memo?.includes(search)
    const mt=tagFilter==='all'||i.tags?.includes(tagFilter)
    return ms&&mt
  }),[items,search,tagFilter])

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filtered, 20)

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>bookmark</Mi>북마크</h1><p className="page-subtitle">유용한 링크와 배포 자료들을 모아요</p></div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}><Mi size='sm'>sell</Mi> 태그 관리</button>
          <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 북마크 추가</button>
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 제목, URL, 메모로 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:320,marginBottom:tags.length>0?10:0}}/>
        {tags.length>0&&(
          <div className="flex gap-8" style={{flexWrap:'wrap',marginTop:8}}>
            <button className={`btn btn-sm ${tagFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setTagFilter('all')}>전체</button>
            {tags.map(t=><button key={t.id} className={`btn btn-sm ${tagFilter===t.name?'btn-primary':'btn-outline'}`} onClick={()=>setTagFilter(t.name)}>{t.name}</button>)}
          </div>
        )}
      </div>
      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="bookmark" title="북마크가 없어요" description="유용한 링크를 추가해보세요!" action={<button className="btn btn-primary" onClick={openNew}>북마크 추가</button>}/>
        :<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:14}}>
          {paged.map(item=>(
            <div key={item.id}
              style={{borderRadius:12,overflow:'hidden',background:'var(--color-surface)',border:'1px solid var(--color-border)',boxShadow:'0 2px 12px var(--color-shadow)',display:'flex',flexDirection:'column',transition:'transform 0.15s, box-shadow 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
            >
              <div style={{height:130,background:'var(--color-nav-active-bg)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer'}}
                onClick={()=>window.open(item.url,'_blank','noopener,noreferrer')}
              >
                {item.thumbnail_url?<img src={item.thumbnail_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'}}/>:<span style={{fontSize:'3rem',opacity:0.2}}><Mi size="lg" color="light">link</Mi></span>}
                {item.tags?.length>0&&(
                  <div style={{position:'absolute',bottom:8,left:8,right:8,display:'flex',gap:4,flexWrap:'wrap'}}>
                    {item.tags.filter(t=>tags.map(tg=>tg.name).includes(t)).map(tag=>(
                      <span key={tag} style={{padding:'2px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:700,background:'#c8a96e',color:'#fff',border:'1px solid #b8944e'}}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{padding:'12px 14px',flex:1,display:'flex',flexDirection:'column',gap:4,cursor:'pointer'}}
                onClick={()=>window.open(item.url,'_blank','noopener,noreferrer')}
              >
                <div style={{fontWeight:700,fontSize:'0.88rem',lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{item.title||item.url}</div>
                {item.description&&<div style={{fontSize:'0.72rem',color:'var(--color-text-light)',lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{item.description}</div>}
                <div style={{fontSize:'0.65rem',color:'var(--color-text-light)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:'auto',paddingTop:4}}><><Mi size='sm' color='light'>link</Mi> {item.url}</></div>
                {item.memo&&<div style={{fontSize:'0.72rem',color:'var(--color-accent)',padding:'5px 8px',borderRadius:6,background:'var(--color-nav-active-bg)',marginTop:4,wordBreak:'break-all',overflowWrap:'break-word',whiteSpace:'pre-wrap'}}><><Mi size='sm' color='accent'>edit_note</Mi> {item.memo}</></div>}
              </div>
              <div style={{padding:'6px 12px 10px',display:'flex',gap:6,justifyContent:'flex-end',borderTop:'1px solid var(--color-border)'}} onClick={e=>e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
        <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
        </>
      }
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'북마크 수정':'북마크 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group">
          <label className="form-label">URL *</label>
          <div style={{display:'flex',gap:8}}>
            <input className="form-input" placeholder="https://..." value={form.url} onChange={set('url')} onBlur={handleUrlBlur} style={{flex:1}}/>
            <button type="button" className="btn btn-outline btn-sm" onClick={doFetch} disabled={fetching} style={{whiteSpace:'nowrap',flexShrink:0}}>{fetching?'로딩...':'🔄 정보 가져오기'}</button>
          </div>
          {fetchMsg&&<div className="text-xs" style={{marginTop:4,color:fetchMsg.startsWith('✅')?'#558b2f':fetchMsg.startsWith('⚠️')?'#e57373':'var(--color-text-light)'}}>{fetchMsg}</div>}
        </div>
        {form.thumbnail_url&&<div style={{marginBottom:12,borderRadius:8,overflow:'hidden',height:100,background:'var(--color-nav-active-bg)'}}><img src={form.thumbnail_url} alt="thumbnail" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'}}/></div>}
        <div className="form-group"><label className="form-label">제목</label><input className="form-input" placeholder="자동으로 가져와요" value={form.title||''} onChange={set('title')}/></div>
        <div className="form-group"><label className="form-label">썸네일 이미지 URL</label><input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.thumbnail_url||''} onChange={set('thumbnail_url')}/></div>
        <div className="form-group">
          <label className="form-label">태그<button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button></label>
          {tags.length===0?<div className="text-xs text-light">태그가 없어요.</div>
            :<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{tags.map(tag=><button key={tag.id} type="button" className={`btn btn-sm ${form.tags?.includes(tag.name)?'btn-primary':'btn-outline'}`} onClick={()=>toggleTag(tag.name)}>{tag.name}</button>)}</div>
          }
        </div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" placeholder="간단한 메모..." value={form.memo||''} onChange={set('memo')} style={{minHeight:64}}/></div>
      </Modal>
      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 북마크 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      ><TagManager tags={tags} onAdd={addTag} onEdit={editTag} onRemove={removeTag} placeholder="도토리, 배포자료, 유틸..."/></Modal>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>{bookmarksApi.remove(confirm);load();setConfirm(null)}} message="이 북마크를 삭제하시겠어요?"/>
    </div>
  )
}
