// src/pages/RulebookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { rulebooksApi, uploadFile } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'

const BLANK = { title:'', system_name:'', publisher:'', cover_image_url:'', purchase_date:'', format:'physical', memo:'' }
const cleanPayload = f => ({...f, purchase_date: f.purchase_date||null})

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
  const [imgUploading, setImgUploading] = useState(false)

  const load = async () => { const {data}=await rulebooksApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }
  const save = async () => {
    if (!form.title) return
    if (editing) await rulebooksApi.update(editing.id, cleanPayload(form))
    else await rulebooksApi.create({...cleanPayload(form), user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await rulebooksApi.remove(id); load() }

  const handleImgUpload = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setImgUploading(true)
    const {url,error} = await uploadFile('covers', `${user.id}/rulebook-${Date.now()}`, file)
    if (url) setForm(f=>({...f, cover_image_url:url}))
    else alert('업로드 실패: '+(error?.message||''))
    setImgUploading(false)
  }

  const filtered = items.filter(i =>
    !search || i.title.includes(search) || i.system_name?.includes(search) || i.publisher?.includes(search)
  )

  const FORMAT_LABEL = { physical:'실물', digital:'전자', both:'실물+전자' }

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📚 보유 룰북</h1>
          <p className="page-subtitle">보유한 TRPG 룰북 목록이에요 ({items.length}권)</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 룰북 추가</button>
      </div>

      <div style={{marginBottom:16}}>
        <input className="form-input" placeholder="🔍 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}} />
      </div>

      {loading ? <LoadingSpinner /> : filtered.length===0
        ? <EmptyState icon="📚" title="룰북이 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>} />
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(item=>(
              <div key={item.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                {/* 아이콘 */}
                <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {item.cover_image_url
                    ? <img src={item.cover_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    : <span style={{fontSize:'1.5rem',opacity:0.4}}>📚</span>
                  }
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:3}}>{item.title}</div>
                  <div className="text-xs text-light flex gap-10">
                    {item.system_name&&<span>🎲 {item.system_name}</span>}
                    {item.publisher&&<span>🏢 {item.publisher}</span>}
                    <span className="badge badge-primary" style={{fontSize:'0.62rem'}}>{FORMAT_LABEL[item.format]||item.format}</span>
                  </div>
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
        <div className="form-group"><label className="form-label">제목 *</label><input className="form-input" placeholder="크툴루의 부름 룰북" value={form.title} onChange={set('title')} /></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))} /></div>
          <div className="form-group"><label className="form-label">출판사</label><input className="form-input" placeholder="KADOKAWA" value={form.publisher||''} onChange={set('publisher')} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">형태</label>
            <select className="form-select" value={form.format} onChange={set('format')}><option value="physical">실물</option><option value="digital">전자</option><option value="both">실물+전자</option></select>
          </div>
          <div className="form-group"><label className="form-label">구매일</label><input className="form-input" type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></div>
        </div>

        {/* 아이콘 이미지 */}
        <div className="form-group">
          <label className="form-label">아이콘 이미지</label>
          <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
            <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.cover_image_url||''} onChange={set('cover_image_url')} style={{flex:1}} />
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>
              {imgUploading?'업로드 중...':'📁 업로드'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImgUpload} disabled={imgUploading} />
            </label>
          </div>
          {form.cover_image_url&&(
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <img src={form.cover_image_url} alt="preview" style={{width:48,height:48,objectFit:'cover',borderRadius:6,border:'1px solid var(--color-border)'}} />
              <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,cover_image_url:''}))}>제거</button>
            </div>
          )}
        </div>

        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:64}} /></div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)} />
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 룰북을 삭제하시겠어요?" />
    </div>
  )
}
