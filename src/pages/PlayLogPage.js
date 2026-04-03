// src/pages/PlayLogPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { playLogsApi, uploadFile } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, StarRating } from '../components/Layout'
import { RuleSelect, RuleManagerModal } from '../components/RuleSelect'
import { format } from 'date-fns'

const BLANK = { title:'', played_date:'', system_name:'', role:'PL', character_name:'', together_with:'', npc:'', rating:0, memo:'', session_image_url:'', scenario_link:'', series_tag:'', session_log_url:'' }
const cleanPayload = f => ({...f, played_date:f.played_date||null})

const TAG_COLORS = {
  series:{bg:'rgba(200,169,110,0.18)',color:'#8b6f47',border:'rgba(200,169,110,0.5)'},
  role_PL:{bg:'rgba(100,149,237,0.15)',color:'#2a5aaa',border:'rgba(100,149,237,0.4)'},
  role_GM:{bg:'rgba(155,137,196,0.15)',color:'#5a3a9c',border:'rgba(155,137,196,0.4)'},
  rule:{bg:'rgba(156,175,136,0.18)',color:'#4a6a30',border:'rgba(156,175,136,0.5)'},
}
function TagChip({ type, label }) {
  const c=type==='series'?TAG_COLORS.series:type==='role'?(label==='GM'?TAG_COLORS.role_GM:TAG_COLORS.role_PL):TAG_COLORS.rule
  return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:100,fontSize:'0.63rem',fontWeight:700,background:c.bg,color:c.color,border:`1px solid ${c.border}`,whiteSpace:'nowrap'}}>{label}</span>
}

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
  const [ruleFilter, setRuleFilter] = useState('all')

  const load = async () => { const {data}=await playLogsApi.getAll(user.id); setItems(data||[]); setLoading(false) }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = () => { setEditing(null); setForm({...BLANK,played_date:new Date().toISOString().split('T')[0]}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }

  const save = async () => {
    if (!form.title||!form.played_date) return
    if (editing) await playLogsApi.update(editing.id, cleanPayload(form))
    else await playLogsApi.create({...cleanPayload(form),user_id:user.id})
    setModal(false); load()
    if (detail&&editing&&detail.id===editing.id) setDetail({...cleanPayload(form),id:editing.id})
  }
  const remove = async id => { await playLogsApi.remove(id); load(); setDetail(null) }

  const handleImageUpload = async e => {
    const file=e.target.files?.[0]; if(!file) return
    setImgUploading(true)
    const {url,error}=await uploadFile('play-images',`${user.id}/session-${Date.now()}`,file)
    if(url) setForm(f=>({...f,session_image_url:url}))
    else alert(error?.message||'업로드 실패')
    setImgUploading(false)
  }

  const seriesList = useMemo(()=>[...new Set(items.map(i=>i.series_tag).filter(Boolean))].sort(),[items])
  const ruleList = useMemo(()=>[...new Set(items.map(i=>i.system_name).filter(Boolean))].sort(),[items])

  const filtered = items.filter(i=>{
    const ms=!search||i.title.includes(search)||i.system_name?.includes(search)||i.together_with?.includes(search)||i.series_tag?.includes(search)
    const mr=ruleFilter==='all'||i.system_name===ruleFilter
    return ms&&mr
  })

  const relatedItems = detail?.series_tag
    ? items.filter(i=>i.series_tag===detail.series_tag&&i.id!==detail.id).sort((a,b)=>(a.played_date||'').localeCompare(b.played_date||''))
    : []

  const InfoRow = ({label, value}) => value ? (
    <div style={{fontSize:'0.63rem',color:'var(--color-text-light)'}}><span style={{fontWeight:600,marginRight:4}}>{label}.</span>{value}</div>
  ) : null

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title">📖 다녀온 기록</h1><p className="page-subtitle">플레이한 세션들의 소중한 기억을 남겨요</p></div>
        <button className="btn btn-primary" onClick={openNew}>+ 기록 추가</button>
      </div>

      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 제목, 룰, 시리즈로 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:320,marginBottom:ruleList.length>0?10:0}}/>
        {ruleList.length>0&&(
          <div className="flex gap-8" style={{flexWrap:'wrap',marginTop:8}}>
            <button className={`btn btn-sm ${ruleFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setRuleFilter('all')}>전체</button>
            {ruleList.map(r=><button key={r} className={`btn btn-sm ${ruleFilter===r?'btn-primary':'btn-outline'}`} onClick={()=>setRuleFilter(r)}>{r}</button>)}
          </div>
        )}
      </div>

      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="📖" title="기록이 없어요" action={<button className="btn btn-primary" onClick={openNew}>기록 추가</button>}/>
        :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(238px, 1fr))',gap:13}}>
          {filtered.map(item=>(
            <div key={item.id}
              style={{borderRadius:12,overflow:'hidden',cursor:'pointer',background:'var(--color-surface)',border:'1px solid var(--color-border)',boxShadow:'0 2px 12px var(--color-shadow)',transition:'transform 0.2s, box-shadow 0.2s',display:'flex',flexDirection:'column'}}
              onClick={()=>setDetail(item)}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.15)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
            >
              <div style={{position:'relative',paddingTop:'56.25%'}}>
                <div style={{position:'absolute',inset:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                  {item.session_image_url?<img src={item.session_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'3rem',opacity:0.2}}>📖</span>}
                </div>
                <div style={{position:'absolute',bottom:0,left:0,right:0,height:'65%',background:'linear-gradient(to top, var(--color-bg) 0%, rgba(255,255,255,0.6) 55%, transparent 100%)',pointerEvents:'none'}}/>
                <div style={{position:'absolute',bottom:10,left:10,right:10,display:'flex',gap:4,flexWrap:'wrap'}}>
                  {item.series_tag&&<TagChip type="series" label={item.series_tag}/>}
                  <TagChip type="role" label={item.role}/>
                  {item.system_name&&<TagChip type="rule" label={item.system_name}/>}
                </div>
              </div>
              {/* 카드 하단 - 시나리오명 크기 맞춤, Date-GM/PL 순서, 간격 */}
              <div style={{padding:'10px 12px 0',flex:1,display:'flex',flexDirection:'column'}}>
                <div style={{fontWeight:700,fontSize:'0.88rem',lineHeight:1.3,color:'var(--color-text)',marginBottom:8}}>{item.title}</div>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  {item.played_date&&<InfoRow label="Date" value={format(new Date(item.played_date),'yyyy.MM.dd')}/>}
                  {item.together_with&&<InfoRow label="GM" value={item.together_with}/>}
                  {item.character_name&&<InfoRow label="PL" value={item.character_name}/>}
                  {item.npc&&<InfoRow label="등장인물" value={item.npc}/>}
                </div>
                {item.rating>0&&<div className="stars" style={{fontSize:'0.72rem',marginTop:6}}>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</div>}
              </div>
              {/* 구분선 + 액션 */}
              <div style={{padding:'8px 12px 10px',marginTop:8,borderTop:'1px solid var(--color-border)',display:'flex',gap:5,justifyContent:'flex-end'}} onClick={e=>e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      }

      {/* 상세 보기 */}
      <Modal isOpen={!!detail} onClose={()=>setDetail(null)} title={detail?.title}
        footer={<div className="flex justify-between w-full"><button className="btn btn-outline btn-sm" onClick={()=>{openEdit(detail);setDetail(null)}}>수정</button><button className="btn btn-outline btn-sm" onClick={()=>setDetail(null)}>닫기</button></div>}
      >
        {detail&&(
          <div>
            {detail.session_image_url&&<img src={detail.session_image_url} alt="세션카드" style={{width:'100%',borderRadius:8,marginBottom:12,maxHeight:200,objectFit:'cover'}}/>}
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>
              {detail.series_tag&&<TagChip type="series" label={detail.series_tag}/>}
              <TagChip type="role" label={detail.role}/>
              {detail.system_name&&<TagChip type="rule" label={detail.system_name}/>}
            </div>
            <div className="grid-2" style={{marginBottom:12}}>
              <div><div className="form-label">엔딩 날짜</div><div className="text-sm">{detail.played_date&&format(new Date(detail.played_date),'yyyy년 M월 d일')}</div></div>
              {detail.together_with&&<div><div className="form-label">GM</div><div className="text-sm">{detail.together_with}</div></div>}
              {detail.character_name&&<div><div className="form-label">PL</div><div className="text-sm">{detail.character_name}</div></div>}
              {detail.npc&&<div><div className="form-label">등장인물</div><div className="text-sm">{detail.npc}</div></div>}
            </div>
            {detail.rating>0&&<div style={{marginBottom:12}}><div className="form-label">평점</div><StarRating value={detail.rating} readOnly/></div>}
            {detail.memo&&<div style={{marginBottom:12}}><div className="form-label">메모</div><p style={{color:'var(--color-text-light)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:'0.85rem'}}>{detail.memo}</p></div>}
            {detail.scenario_link&&<div style={{marginBottom:6}}><a href={detail.scenario_link} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem'}}>🔗 시나리오 링크</a></div>}
            {detail.session_log_url&&<div style={{marginBottom:12}}><a href={detail.session_log_url} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem'}}>📝 세션 로그 백업</a></div>}
            {relatedItems.length>0&&(
              <div style={{borderTop:'1px solid var(--color-border)',paddingTop:14,marginTop:4}}>
                <div style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:10}}>📚 {detail.series_tag} 시리즈의 다른 기록 ({relatedItems.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {relatedItems.map(r=>(
                    <div key={r.id} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',borderRadius:8,background:'var(--color-nav-active-bg)',cursor:'pointer'}} onClick={()=>setDetail(r)}>
                      <div style={{width:44,height:44,borderRadius:6,overflow:'hidden',flexShrink:0,background:'var(--color-border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {r.session_image_url?<img src={r.session_image_url} alt={r.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.2rem',opacity:0.4}}>📖</span>}
                      </div>
                      <div style={{flex:1,overflow:'hidden'}}>
                        <div style={{fontWeight:600,fontSize:'0.84rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</div>
                        <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                          <TagChip type="role" label={r.role}/>
                          {r.system_name&&<TagChip type="rule" label={r.system_name}/>}
                          <span className="text-xs text-light">{r.played_date&&format(new Date(r.played_date),'yyyy.MM.dd')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'기록 수정':'기록 추가'}
        footer={<><button className="btn btn-ghost btn-sm" onClick={()=>setRuleManager(true)}>룰 관리</button><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">제목 (시나리오명) *</label><input className="form-input" placeholder="어둠 속의 가면" value={form.title} onChange={set('title')}/></div>
        <div className="form-group"><label className="form-label">엔딩 날짜 *</label><input className="form-input" type="date" value={form.played_date||''} onChange={set('played_date')}/></div>
        <div className="form-group">
          <label className="form-label">시리즈 / 캠페인 태그</label>
          <input className="form-input" placeholder="예: 황혼의 왕관 캠페인..." value={form.series_tag||''} onChange={set('series_tag')}/>
          {seriesList.length>0&&<div style={{marginTop:6,display:'flex',gap:5,flexWrap:'wrap'}}><span className="text-xs text-light" style={{alignSelf:'center'}}>기존:</span>{seriesList.map(s=><button key={s} type="button" className="btn btn-outline btn-sm" style={{fontSize:'0.7rem',padding:'2px 8px'}} onClick={()=>setForm(f=>({...f,series_tag:s}))}>{s}</button>)}</div>}
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
          <div className="form-group"><label className="form-label">역할</label><select className="form-select" value={form.role} onChange={set('role')}><option value="PL">PL</option><option value="GM">GM</option></select></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">PL</label><input className="form-input" placeholder="캐릭터명" value={form.character_name||''} onChange={set('character_name')}/></div>
          <div className="form-group"><label className="form-label">GM</label><input className="form-input" placeholder="닉네임" value={form.together_with||''} onChange={set('together_with')}/></div>
        </div>
        <div className="form-group"><label className="form-label">등장인물</label><input className="form-input" placeholder="주요 등장인물, NPC 등..." value={form.npc||''} onChange={set('npc')}/></div>
        <div className="form-group"><label className="form-label">평점</label><StarRating value={form.rating} onChange={v=>setForm(f=>({...f,rating:v}))}/></div>
        <div className="form-group">
          <label className="form-label">세션카드 이미지</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.session_image_url||''} onChange={set('session_image_url')} style={{flex:1}}/>
            <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>{imgUploading?'업로드 중...':'📁 업로드'}<input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} disabled={imgUploading}/></label>
          </div>
          {form.session_image_url&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}><img src={form.session_image_url} alt="preview" style={{width:60,height:34,objectFit:'cover',borderRadius:5,border:'1px solid var(--color-border)'}}/><button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,session_image_url:''}))}>제거</button></div>}
        </div>
        <div className="form-group"><label className="form-label">시나리오 링크 URL</label><input className="form-input" placeholder="https://..." value={form.scenario_link||''} onChange={set('scenario_link')}/></div>
        <div className="form-group"><label className="form-label">세션 로그 백업 URL</label><input className="form-input" placeholder="https://..." value={form.session_log_url||''} onChange={set('session_log_url')}/></div>
        <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" value={form.memo||''} onChange={set('memo')}/></div>
      </Modal>

      <RuleManagerModal isOpen={ruleManager} onClose={()=>setRuleManager(false)}/>
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 기록을 삭제하시겠어요?"/>
    </div>
  )
}
