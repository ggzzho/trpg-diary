// src/pages/RulebookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { rulebooksApi, uploadFile, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', system_name:'', cover_image_url:'', format:'physical', memo:'', tags:[] }
const DEFAULT_TAG_NAMES = ['GM','주력','미숙','관심','초보','입문','미입문']

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
  const [tagModal, setTagModal] = useState(false)
  const [availableTags, setAvailableTags] = useState([])
  const [imgUploading, setImgUploading] = useState(false)

  const load = async () => { const {data}=await rulebooksApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  const loadTags = async () => {
    const {data}=await supabase.from('rulebook_tags').select('*').eq('user_id',user.id).order('name')
    if (data&&data.length===0) {
      await supabase.from('rulebook_tags').insert(DEFAULT_TAG_NAMES.map(name=>({user_id:user.id,name})))
      const {data:d2}=await supabase.from('rulebook_tags').select('*').eq('user_id',user.id).order('name')
      setAvailableTags(d2||[])
    } else setAvailableTags(data||[])
  }
  useEffect(() => { load(); loadTags() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const toggleTag = tag => setForm(f=>({...f,tags:f.tags?.includes(tag)?f.tags.filter(t=>t!==tag):[...(f.tags||[]),tag]}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item,tags:item.tags||[]}); setModal(true) }

  const save = async () => {
    if (!form.title) return
    if (editing) await rulebooksApi.update(editing.id, form)
    else await rulebooksApi.create({...form,user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await rulebooksApi.remove(id); load() }

  const handleImgUpload = async e => {
    const file=e.target.files?.[0]; if(!file) return
    setImgUploading(true)
    const {url,error}=await uploadFile('covers',`${user.id}/rulebook-${Date.now()}`,file)
    if(url) setForm(f=>({...f,cover_image_url:url}))
    else alert(error?.message||'업로드 실패')
    setImgUploading(false)
  }

  const addTag = async name => { await supabase.from('rulebook_tags').insert({user_id:user.id,name}); loadTags() }
  const editTag = async (id,name) => { await supabase.from('rulebook_tags').update({name}).eq('id',id); loadTags() }
  const removeTagDef = async id => { await supabase.from('rulebook_tags').delete().eq('id',id); loadTags() }

  const filtered = items.filter(i=>!search||i.title.includes(search)||i.system_name?.includes(search))
  const FORMAT_LABEL = {physical:'실물',digital:'전자',both:'실물+전자'}

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title">📚 보유 룰북</h1><p className="page-subtitle">보유한 TRPG 룰북 목록이에요 ({items.length}권)</p></div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}>🏷️ 태그 관리</button>
          <button className="btn btn-primary" onClick={openNew}>+ 룰북 추가</button>
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}}/>
      </div>

      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="📚" title="룰북이 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(item=>(
            <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {item.cover_image_url?<img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.5rem',opacity:0.4}}>📚</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:4}}>{item.title}</div>
                {/* 룰이름 · 칩 간격 추가 */}
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:item.tags?.length>0?5:0}}>
                  {item.system_name&&<span className="text-xs text-light">🎲 {item.system_name}</span>}
                  <span className="badge badge-primary" style={{fontSize:'0.62rem'}}>{FORMAT_LABEL[item.format]||item.format}</span>
                </div>
                {item.tags?.length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {item.tags.map(t=><span key={t} style={{padding:'1px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:600,background:'var(--color-nav-active-bg)',color:'var(--color-accent)',border:'1px solid var(--color-border)'}}>{t}</span>)}
                  </div>
                )}
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

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'룰북 수정':'룰북 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" value={form.title} onChange={set('title')}/></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
          <div className="form-group"><label className="form-label">형태</label><select className="form-select" value={form.format} onChange={set('format')}><option value="physical">실물</option><option value="digital">전자</option><option value="both">실물+전자</option></select></div>
        </div>
        <div className="form-group">
          <label className="form-label">태그<button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button></label>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {availableTags.map(tag=><button key={tag.id} type="button" className={`btn btn-sm ${form.tags?.includes(tag.name)?'btn-primary':'btn-outline'}`} onClick={()=>toggleTag(tag.name)}>{tag.name}</button>)}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">아이콘 이미지</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.cover_image_url||''} onChange={set('cover_image_url')} style={{flex:1}}/>
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>{imgUploading?'업로드 중...':'📁 업로드'}<input type="file" accept="image/*" style={{display:'none'}} onChange={handleImgUpload} disabled={imgUploading}/></label>
          </div>
          {form.cover_image_url&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}><img src={form.cover_image_url} alt="preview" style={{width:48,height:48,objectFit:'cover',borderRadius:6,border:'1px solid var(--color-border)'}}/><button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,cover_image_url:''}))}>제거</button></div>}
        </div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:64}}/></div>
      </Modal>

      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 룰북 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      >
        <TagManager tags={availableTags} onAdd={addTag} onEdit={editTag} onRemove={removeTagDef} placeholder="GM, 주력, 관심, 입문..."/>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)}/>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 룰북을 삭제하시겠어요?"/>
    </div>
  )
}
