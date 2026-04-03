// src/pages/PlayLogPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { playLogsApi, uploadFile } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, StarRating } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'
import { format } from 'date-fns'

const BLANK = {
  title:'', played_date:'', system_name:'', role:'PL',
  venue:'', character_name:'', together_with:'', rating:0, memo:'',
  session_image_url:'', scenario_link:''
}

const cleanPayload = f => ({...f, played_date: f.played_date||null})

export function PlayLogPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [ruleManager, setRuleManager] = useState(false)
  const [search, setSearch] = useState('')
  const [imgUploading, setImgUploading] = useState(false)

  const load = async () => { const {data}=await playLogsApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const openNew = () => { setEditing(null); setForm({...BLANK, played_date:new Date().toISOString().split('T')[0]}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }

  const save = async () => {
    if (!form.title||!form.played_date) return
    if (editing) await playLogsApi.update(editing.id, cleanPayload(form))
    else await playLogsApi.create({...cleanPayload(form), user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await playLogsApi.remove(id); load() }

  const handleImageUpload = async e => {
    const file = e.target.files?.[0]; if (!file) return
    setImgUploading(true)
    const {url,error} = await uploadFile('play-images', `${user.id}/session-${Date.now()}`, file)
    if (url) setForm(f=>({...f, session_image_url:url}))
    else alert('업로드 실패: '+(error?.message||''))
    setImgUploading(false)
  }

  const filtered = items.filter(i =>
    !search || i.title.includes(search) || i.system_name?.includes(search) || i.together_with?.includes(search)
  )

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📖 다녀온 기록</h1>
          <p className="page-subtitle">플레이한 세션들의 소중한 기억을 남겨요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 기록 추가</button>
      </div>

      {/* 검색 */}
      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 제목, 룰, 함께한 사람으로 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:360}} />
      </div>

      {loading ? <LoadingSpinner /> : filtered.length===0
        ? <EmptyState icon="📖" title="기록이 없어요" action={<button className="btn btn-primary" onClick={openNew}>기록 추가</button>} />
        : (
          <div className="grid-auto">
            {filtered.map(item=>(
              <div key={item.id} className="card" style={{padding:0,overflow:'hidden',cursor:'pointer'}} onClick={()=>setDetail(item)}>
                {/* 섬네일 */}
                <div style={{
                  height:140, background:'var(--color-nav-active-bg)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  overflow:'hidden', position:'relative'
                }}>
                  {item.session_image_url
                    ? <img src={item.session_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    : <span style={{fontSize:'3rem',opacity:0.3}}>📖</span>
                  }
                  <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4}}>
                    <span className={`badge ${item.role==='GM'?'badge-primary':'badge-blue'}`}>{item.role}</span>
                  </div>
                </div>
                {/* 내용 */}
                <div style={{padding:'12px 14px'}}>
                  <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:5}}>{item.title}</div>
                  <div className="text-xs text-light" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:5}}>
                    {item.played_date&&<span>📅 {format(new Date(item.played_date),'yyyy.MM.dd')}</span>}
                    {item.system_name&&<span>🎲 {item.system_name}</span>}
                  </div>
                  {item.together_with&&<div className="text-xs text-light">👥 {item.together_with}</div>}
                  {item.rating>0&&<div className="stars" style={{fontSize:'0.8rem',marginTop:5}}>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</div>}
                </div>
                {/* 액션 */}
                <div style={{padding:'8px 14px',borderTop:'1px solid var(--color-border)',display:'flex',gap:8,justifyContent:'flex-end'}} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* 상세 보기 */}
      <Modal isOpen={!!detail} onClose={()=>setDetail(null)} title={detail?.title}
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setDetail(null)}>닫기</button>}
      >
        {detail&&(
          <div>
            {detail.session_image_url&&(
              <img src={detail.session_image_url} alt="세션카드" style={{width:'100%',borderRadius:8,marginBottom:14,maxHeight:200,objectFit:'cover'}} />
            )}
            <div className="grid-2" style={{marginBottom:14}}>
              <div><div className="form-label">엔딩 날짜</div><div className="text-sm">{detail.played_date&&format(new Date(detail.played_date),'yyyy년 M월 d일')}</div></div>
              <div><div className="form-label">역할</div><div className="text-sm">{detail.role}</div></div>
              {detail.system_name&&<div><div className="form-label">룰</div><div className="text-sm">{detail.system_name}</div></div>}
              {detail.venue&&<div><div className="form-label">사이트</div><div className="text-sm">{detail.venue}</div></div>}
              {detail.character_name&&<div><div className="form-label">캐릭터명</div><div className="text-sm">{detail.character_name}</div></div>}
              {detail.together_with&&<div><div className="form-label">함께한 사람</div><div className="text-sm">{detail.together_with}</div></div>}
            </div>
            {detail.rating>0&&<div style={{marginBottom:12}}><div className="form-label">평점</div><StarRating value={detail.rating} readOnly /></div>}
            {detail.scenario_link&&<div style={{marginBottom:12}}><a href={detail.scenario_link} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem'}}>🔗 시나리오 링크</a></div>}
            {detail.memo&&<div><div className="form-label">메모</div><p style={{color:'var(--color-text-light)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:'0.85rem'}}>{detail.memo}</p></div>}
          </div>
        )}
      </Modal>

      {/* 등록/수정 모달 */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'기록 수정':'기록 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 (시나리오명) *</label><input className="form-input" placeholder="어둠 속의 가면" value={form.title} onChange={set('title')} /></div>
        <div className="form-group"><label className="form-label">엔딩 날짜 *</label><input className="form-input" type="date" value={form.played_date||''} onChange={set('played_date')} /></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))} /></div>
          <div className="form-group"><label className="form-label">사이트</label><input className="form-input" placeholder="roll20, 코코포리아..." value={form.venue||''} onChange={set('venue')} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">역할</label>
            <select className="form-select" value={form.role} onChange={set('role')}><option value="PL">PL</option><option value="GM">GM</option></select>
          </div>
          <div className="form-group"><label className="form-label">캐릭터명</label><input className="form-input" placeholder="홍길동" value={form.character_name||''} onChange={set('character_name')} /></div>
        </div>
        <div className="form-group"><label className="form-label">함께한 사람</label><input className="form-input" placeholder="함께한 분의 닉네임..." value={form.together_with||''} onChange={set('together_with')} /></div>
        <div className="form-group"><label className="form-label">평점</label><StarRating value={form.rating} onChange={v=>setForm(f=>({...f,rating:v}))} /></div>

        {/* 세션카드 이미지 */}
        <div className="form-group">
          <label className="form-label">세션카드 이미지</label>
          <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
            <input className="form-input" placeholder="https://... 이미지 URL" value={form.session_image_url||''} onChange={set('session_image_url')} style={{flex:1}} />
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>
              {imgUploading?'업로드 중...':'📁 업로드'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} disabled={imgUploading} />
            </label>
          </div>
          {form.session_image_url&&(
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <img src={form.session_image_url} alt="preview" style={{width:80,height:50,objectFit:'cover',borderRadius:5,border:'1px solid var(--color-border)'}} />
              <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,session_image_url:''}))}>제거</button>
            </div>
          )}
        </div>

        <div className="form-group"><label className="form-label">시나리오 링크 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_link||''} onChange={set('scenario_link')} /></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} /></div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)} />
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 기록을 삭제하시겠어요?" />
    </div>
  )
}
