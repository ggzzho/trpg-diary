// src/pages/PairsPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { pairsApi, uploadFile, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager } from '../components/Layout'
import { Mi } from '../components/Mi'

const BLANK = { name:'', nickname:'', memo:'', relations:[], first_met_date:'', pair_image_url:'' }
const cleanPayload = f => ({...f, first_met_date:f.first_met_date||null, relations:f.relations||[]})
function calcDday(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date()-new Date(dateStr))/(1000*60*60*24))
}

export function PairsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [imgUploading, setImgUploading] = useState(false)
  const [relationTags, setRelationTags] = useState([])
  const [tagModal, setTagModal] = useState(false)
  const [tagFilter, setTagFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('asc')

  const load = async () => { const {data}=await pairsApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  const loadTags = async () => {
    const {data}=await supabase.from('pair_relations').select('*').eq('user_id',user.id).order('name')
    setRelationTags(data||[])
  }
  useEffect(() => { load(); loadTags() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const toggleRelation = tag => setForm(f=>({...f,relations:f.relations?.includes(tag)?f.relations.filter(r=>r!==tag):[...(f.relations||[]),tag]}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item,relations:item.relations||[]}); setModal(true) }
  const save = async () => {
    if (!form.name) return
    const validTagNames = relationTags.map(t=>t.name)
    const cleanedRelations = (form.relations||[]).filter(r=>validTagNames.includes(r))
    const payload = cleanPayload({...form,relations:cleanedRelations})
    if (editing) await pairsApi.update(editing.id,payload)
    else await pairsApi.create({...payload,user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await pairsApi.remove(id); load() }

  const handleImgUpload = async e => {
    const file=e.target.files?.[0]; if(!file) return
    setImgUploading(true)
    const {url,error}=await uploadFile('avatars',`${user.id}/pair-${Date.now()}`,file)
    if(url) setForm(f=>({...f,pair_image_url:url}))
    else alert(error?.message||'업로드 실패')
    setImgUploading(false)
  }

  const addTag = async name => { await supabase.from('pair_relations').insert({user_id:user.id,name}); loadTags() }
  const editTag = async (id,name) => {
    const oldTag=relationTags.find(t=>t.id===id)?.name
    if (oldTag) { const affected=items.filter(i=>i.relations?.includes(oldTag)); for(const item of affected) await pairsApi.update(item.id,{...item,relations:item.relations.map(r=>r===oldTag?name:r)}) }
    await supabase.from('pair_relations').update({name}).eq('id',id); load(); loadTags()
  }
  const removeTag = async id => {
    const tagName=relationTags.find(t=>t.id===id)?.name
    if (tagName) { const affected=items.filter(i=>i.relations?.includes(tagName)); for(const item of affected) await pairsApi.update(item.id,{...item,relations:item.relations.filter(r=>r!==tagName)}) }
    await supabase.from('pair_relations').delete().eq('id',id); load(); loadTags()
  }

  const filtered = items
    .filter(i=>tagFilter==='all'||i.relations?.includes(tagFilter))
    .sort((a,b)=>{
      const da=a.first_met_date||'', db=b.first_met_date||''
      return sortOrder==='asc'?da.localeCompare(db):db.localeCompare(da)
    })

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>people</Mi>페어 목록</h1><p className="page-subtitle">함께한 소중한 동료들을 기록해요 ({items.length}명)</p></div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}><Mi size='sm'>sell</Mi> 관계 관리</button>
          <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 페어 추가</button>
        </div>
      </div>

      {/* 정렬 + 태그 필터 - 간격 추가 */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,flexWrap:'wrap'}}>
        <div className="flex gap-10">
          <button className={`btn btn-sm ${sortOrder==='asc'?'btn-primary':'btn-outline'}`} onClick={()=>setSortOrder('asc')}><Mi size='sm'>arrow_upward</Mi> 오름차순</button>
          <button className={`btn btn-sm ${sortOrder==='desc'?'btn-primary':'btn-outline'}`} onClick={()=>setSortOrder('desc')}><Mi size='sm'>arrow_downward</Mi> 내림차순</button>
        </div>
        {relationTags.length>0&&(
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div style={{width:1,height:20,background:'var(--color-border)'}}/>
            <button className={`btn btn-sm ${tagFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setTagFilter('all')}>전체</button>
            {relationTags.map(t=><button key={t.id} className={`btn btn-sm ${tagFilter===t.name?'btn-primary':'btn-outline'}`} onClick={()=>setTagFilter(t.name)}>{t.name}</button>)}
          </div>
        )}
      </div>

      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="people" title="페어가 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        :<div className="grid-auto">
          {filtered.map(item=>{
            const dday=calcDday(item.first_met_date)
            const validTagNames=relationTags.map(t=>t.name)
            const displayRelations=(item.relations||[]).filter(r=>validTagNames.includes(r))
            return (
              <div key={item.id} className="card" style={{padding:0,overflow:'hidden'}}>
                <div style={{height:160,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                  {item.pair_image_url?<img src={item.pair_image_url} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'4rem',opacity:0.25}}>👤</span>}
                  {dday!==null&&(
                    <div style={{position:'absolute',top:10,right:10,background:'var(--color-primary)',color:'white',borderRadius:8,padding:'4px 10px',textAlign:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
                      <div style={{fontSize:'0.6rem',opacity:0.85}}>함께한 지</div>
                      <div style={{fontSize:'1.1rem',fontWeight:700,lineHeight:1.2}}>D+{dday}</div>
                    </div>
                  )}
                </div>
                <div style={{padding:'12px 14px'}}>
                  <div style={{fontWeight:700,fontSize:'1rem',marginBottom:4}}>{item.name}</div>

                  {displayRelations.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>{displayRelations.map(r=><span key={r} className="badge badge-primary">{r}</span>)}</div>}
                  {item.first_met_date&&<div className="text-xs text-light"><><Mi size='sm' color='light'>calendar_today</Mi> {item.first_met_date}</> 첫 만남</div>}
                  {item.memo&&<p className="text-xs text-light" style={{marginTop:8,borderTop:'1px solid var(--color-border)',paddingTop:8}}>{item.memo}</p>}
                </div>
                <div style={{padding:'8px 14px',borderTop:'1px solid var(--color-border)',display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      }
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'페어 수정':'페어 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">페어명 *</label><input className="form-input" value={form.name} onChange={set('name')}/></div>
        <div className="form-group">
          <label className="form-label">페어 이미지</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.pair_image_url||''} onChange={set('pair_image_url')} style={{flex:1}}/>
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>{imgUploading?'업로드 중...':'📁 업로드'}<input type="file" accept="image/*" style={{display:'none'}} onChange={handleImgUpload} disabled={imgUploading}/></label>
          </div>
          {form.pair_image_url&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}><img src={form.pair_image_url} alt="preview" style={{width:52,height:52,objectFit:'cover',borderRadius:8,border:'1px solid var(--color-border)'}}/><button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,pair_image_url:''}))}>제거</button></div>}
        </div>
        <div className="form-group">
          <label className="form-label">관계<button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button></label>
          {relationTags.length===0?<div className="text-xs text-light">관계 태그가 없어요.</div>
            :<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{relationTags.map(tag=><button key={tag.id} type="button" className={`btn btn-sm ${form.relations?.includes(tag.name)?'btn-primary':'btn-outline'}`} onClick={()=>toggleRelation(tag.name)}>{tag.name}</button>)}</div>
          }
        </div>
        <div className="form-group"><label className="form-label">처음 만난 날</label><input className="form-input" type="date" value={form.first_met_date||''} onChange={set('first_met_date')}/></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:70}}/></div>
      </Modal>
      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 관계 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      ><TagManager tags={relationTags} onAdd={addTag} onEdit={editTag} onRemove={removeTag} placeholder="연인, 친구, 가족..."/></Modal>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 페어를 삭제하시겠어요?"/>
    </div>
  )
}
