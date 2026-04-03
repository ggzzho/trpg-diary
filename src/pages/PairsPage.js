// src/pages/PairsPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { pairsApi, uploadFile, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'

const BLANK = { name:'', nickname:'', systems:[], memo:'', relations:[], first_met_date:'', pair_image_url:'' }

const cleanPayload = f => ({
  ...f,
  first_met_date: f.first_met_date||null,
  systems: typeof f.systems==='string' ? f.systems.split(',').map(s=>s.trim()).filter(Boolean) : (f.systems||[]),
  relations: f.relations||[],
})

// D-day 계산
function calcDday(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((new Date() - new Date(dateStr)) / (1000*60*60*24))
  return diff
}

export function PairsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [imgUploading, setImgUploading] = useState(false)
  // 관계 태그 관리
  const [relationTags, setRelationTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [tagModal, setTagModal] = useState(false)

  const load = async () => { const {data}=await pairsApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  const loadTags = async () => {
    const {data} = await supabase.from('pair_relations').select('*').eq('user_id',user.id).order('name')
    setRelationTags(data||[])
  }
  useEffect(() => { load(); loadTags() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const toggleRelation = tag => setForm(f => ({...f, relations: f.relations?.includes(tag) ? f.relations.filter(r=>r!==tag) : [...(f.relations||[]),tag]}))

  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item, systems:item.systems||[], relations:item.relations||[]}); setModal(true) }

  const save = async () => {
    if (!form.name) return
    const payload = cleanPayload(form)
    if (editing) await pairsApi.update(editing.id, payload)
    else await pairsApi.create({...payload, user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await pairsApi.remove(id); load() }

  const handleImgUpload = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setImgUploading(true)
    const {url,error} = await uploadFile('avatars', `${user.id}/pair-${Date.now()}`, file)
    if (url) setForm(f=>({...f,pair_image_url:url}))
    else alert('업로드 실패: '+(error?.message||''))
    setImgUploading(false)
  }

  const addTag = async () => {
    if (!newTag.trim()) return
    await supabase.from('pair_relations').insert({user_id:user.id, name:newTag.trim()})
    setNewTag(''); loadTags()
  }
  const removeTag = async id => {
    await supabase.from('pair_relations').delete().eq('id',id)
    loadTags()
  }

  const filtered = items.filter(i => !search || i.name.includes(search) || i.nickname?.includes(search))

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">👥 페어 목록</h1>
          <p className="page-subtitle">함께한 소중한 동료들을 기록해요 ({items.length}명)</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}>🏷️ 관계 관리</button>
          <button className="btn btn-primary" onClick={openNew}>+ 페어 추가</button>
        </div>
      </div>

      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 페어명으로 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:300}} />
      </div>

      {loading ? <LoadingSpinner /> : filtered.length===0
        ? <EmptyState icon="👥" title="페어가 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>} />
        : <div className="grid-auto">
            {filtered.map(item=>{
              const dday = calcDday(item.first_met_date)
              return (
                <div key={item.id} className="card">
                  {/* 페어 이미지 */}
                  <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:12}}>
                    <div style={{width:56,height:56,borderRadius:10,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {item.pair_image_url
                        ? <img src={item.pair_image_url} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                        : <span style={{fontSize:'1.6rem',opacity:0.4}}>👤</span>
                      }
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'0.95rem'}}>{item.name}</div>
                      {item.nickname&&<div className="text-xs text-light">캐릭터: {item.nickname}</div>}
                      {dday!==null&&(
                        <div style={{fontSize:'0.72rem',color:'var(--color-primary)',fontWeight:600,marginTop:2}}>
                          D+{dday}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                      <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                    </div>
                  </div>

                  {/* 관계 태그 */}
                  {item.relations?.length>0&&(
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                      {item.relations.map(r=>(
                        <span key={r} className="badge badge-primary">{r}</span>
                      ))}
                    </div>
                  )}

                  <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:3}}>
                    {item.first_met_date&&<span>📅 {item.first_met_date} 첫 만남</span>}
                    {item.systems?.length>0&&<span>📌 {item.systems.join(', ')}</span>}
                  </div>
                  {item.memo&&<p className="text-sm" style={{marginTop:8,color:'var(--color-text-light)',borderTop:'1px solid var(--color-border)',paddingTop:8}}>{item.memo}</p>}
                </div>
              )
            })}
          </div>
      }

      {/* 페어 추가/수정 모달 */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'페어 수정':'페어 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="grid-2">
          <div className="form-group"><label className="form-label">페어명 *</label><input className="form-input" value={form.name} onChange={set('name')} /></div>
          <div className="form-group"><label className="form-label">페어 캐릭터명</label><input className="form-input" placeholder="캐릭터 이름" value={form.nickname||''} onChange={set('nickname')} /></div>
        </div>

        {/* 페어 이미지 */}
        <div className="form-group">
          <label className="form-label">페어 이미지</label>
          <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
            <input className="form-input" placeholder="https://..." value={form.pair_image_url||''} onChange={set('pair_image_url')} style={{flex:1}} />
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>
              {imgUploading?'업로드 중...':'📁 업로드'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImgUpload} disabled={imgUploading} />
            </label>
          </div>
          {form.pair_image_url&&(
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <img src={form.pair_image_url} alt="preview" style={{width:52,height:52,objectFit:'cover',borderRadius:8,border:'1px solid var(--color-border)'}} />
              <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,pair_image_url:''}))}>제거</button>
            </div>
          )}
        </div>

        {/* 관계 태그 다중 선택 */}
        <div className="form-group">
          <label className="form-label">관계
            <button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button>
          </label>
          {relationTags.length===0
            ? <div className="text-xs text-light">관계 태그가 없어요. "태그 관리"에서 추가해주세요!</div>
            : <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {relationTags.map(tag=>(
                  <button key={tag.id} type="button"
                    className={`btn btn-sm ${form.relations?.includes(tag.name)?'btn-primary':'btn-outline'}`}
                    onClick={()=>toggleRelation(tag.name)}
                  >{tag.name}</button>
                ))}
              </div>
          }
        </div>

        <div className="form-group"><label className="form-label">처음 만난 날</label><input className="form-input" type="date" value={form.first_met_date||''} onChange={set('first_met_date')} /></div>
        <div className="form-group"><label className="form-label">함께한 시스템 (쉼표로 구분)</label><input className="form-input" placeholder="CoC, D&D..." value={Array.isArray(form.systems)?form.systems.join(', '):form.systems||''} onChange={set('systems')} /></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:70}} /></div>
      </Modal>

      {/* 관계 태그 관리 모달 */}
      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 관계 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      >
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input className="form-input" placeholder="연인, 친구, 가족, 혐관, 애증..." value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} style={{flex:1}} />
          <button className="btn btn-primary btn-sm" onClick={addTag}>추가</button>
        </div>
        {relationTags.length===0
          ? <div className="text-sm text-light" style={{textAlign:'center',padding:'16px 0'}}>아직 태그가 없어요</div>
          : <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {relationTags.map(tag=>(
                <div key={tag.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderRadius:8,background:'var(--color-nav-active-bg)',border:'1px solid var(--color-border)'}}>
                  <span style={{fontSize:'0.88rem'}}>{tag.name}</span>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373',padding:'2px 8px'}} onClick={()=>removeTag(tag.id)}>삭제</button>
                </div>
              ))}
            </div>
        }
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 페어를 삭제하시겠어요?" />
    </div>
  )
}
