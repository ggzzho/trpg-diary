// src/pages/PlayLogPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { playLogsApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, Pagination } from '../components/Layout'
import { Mi } from '../components/Mi'
import { RuleSelect } from '../components/RuleSelect'
import { format } from 'date-fns'
import { usePagination } from '../hooks/usePagination'
import { getTodayKST } from '../lib/dateFormatters'
import { handleStorageLimitError } from '../lib/storageError'

const BLANK = {
  title:'', start_date:'', played_date:'', system_name:'', role:'PL',
  character_name:'', together_with:'', npc:'', memo:'',
  session_image_url:'', scenario_link:'', series_tag:'', session_log_url:'',
  spoiler_content:'', spoiler_password:'', is_private:false, extra_urls:[]
}
const cleanPayload = f => { const { id, user_id, created_at, ...rest } = f; return {...rest, played_date:f.played_date||null, start_date:f.start_date||null, extra_urls:f.extra_urls||[]} }

// ── 태그칩: 완전 불투명 ──
const TAG_COLORS = {
  series:{bg:'#c8a96e',color:'#fff',border:'#b8944e'},
  role_PL:{bg:'#4a7ad4',color:'#fff',border:'#3a6ac4'},
  role_GM:{bg:'#7a5ab8',color:'#fff',border:'#6a4aa8'},
  rule:{bg:'#5a8a40',color:'#fff',border:'#4a7a30'},
}
function TagChip({ type, label }) {
  const c = type==='series'?TAG_COLORS.series:type==='role'?(label==='GM'?TAG_COLORS.role_GM:TAG_COLORS.role_PL):TAG_COLORS.rule
  return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:100,fontSize:'0.63rem',fontWeight:700,background:c.bg,color:c.color,border:`1px solid ${c.border}`,whiteSpace:'nowrap'}}>{label}</span>
}

// 스포일러 표시 컴포넌트
export function SpoilerBlock({ detail, isOwner }) {
  const [pw, setPw] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [err, setErr] = useState(false)

  if (!detail.spoiler_content) return null

  const check = () => {
    if (pw === detail.spoiler_password) { setUnlocked(true); setErr(false) }
    else { setErr(true) }
  }

  return (
    <div style={{marginTop:12,borderTop:'1px solid var(--color-border)',paddingTop:12}}>
      <div style={{fontWeight:700,fontSize:'0.82rem',color:'#e57373',marginBottom:8}}><Mi size='sm' color='danger'>warning</Mi> 스포일러 내용</div>
      {(isOwner || unlocked)
        ? <div style={{padding:12,borderRadius:8,background:'rgba(229,115,115,0.08)',border:'1px solid rgba(229,115,115,0.2)'}}>
            <p style={{color:'var(--color-text-light)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:'0.85rem'}}>{detail.spoiler_content}</p>
          </div>
        : <div>
            <p className="text-xs text-light" style={{marginBottom:8}}>스포일러 비밀번호를 입력하면 열람할 수 있어요.</p>
            <div style={{display:'flex',gap:8}}>
              <input className="form-input" type="password" placeholder="비밀번호"
                value={pw} onChange={e=>{setPw(e.target.value);setErr(false)}}
                onKeyDown={e=>e.key==='Enter'&&check()}
                autoComplete="new-password" style={{flex:1}}/>
              <button className="btn btn-outline btn-sm" onClick={check}>확인</button>
            </div>
            {err && <p className="text-xs" style={{color:'#e57373',marginTop:4}}>비밀번호가 틀렸어요.</p>}
          </div>
      }
    </div>
  )
}

// 상세 내용 컴포넌트 (내부 + 공개 페이지 공통)
export function LogDetailContent({ detail, isOwner }) {
  return (
    <div>
      {detail.session_image_url && (
        <img src={detail.session_image_url} alt="세션카드" style={{width:'100%',borderRadius:8,marginBottom:12,maxHeight:200,objectFit:'cover'}}/>
      )}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>
        {detail.series_tag && <TagChip type="series" label={detail.series_tag}/>}
        <TagChip type="role" label={detail.role}/>
        {detail.system_name && <TagChip type="rule" label={detail.system_name}/>}
      </div>
      <div className="grid-2" style={{marginBottom:12}}>
        {detail.start_date && (
          <div>
            <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text-light)',marginBottom:3}}>시작 날짜</div>
            <div className="text-sm">{format(new Date(detail.start_date),'yyyy년 M월 d일')}</div>
          </div>
        )}
        <div>
          <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text-light)',marginBottom:3}}>엔딩 날짜</div>
          <div className="text-sm">{detail.played_date && format(new Date(detail.played_date),'yyyy년 M월 d일')}</div>
        </div>
        {(detail.together_with||detail.character_name) && (
          <div>
            <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text-light)',marginBottom:3}}>GM / PL</div>
            <div className="text-sm">{[detail.together_with,detail.character_name].filter(Boolean).join(' / ')}</div>
          </div>
        )}
        {detail.npc && (
          <div>
            <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text-light)',marginBottom:3}}>등장인물</div>
            <div className="text-sm">{detail.npc}</div>
          </div>
        )}
      </div>
      {detail.memo && (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--color-text-light)',marginBottom:3}}>메모</div>
          <p style={{color:'var(--color-text-light)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:'0.85rem'}}>{detail.memo}</p>
        </div>
      )}
      {detail.scenario_link && <div style={{marginBottom:6}}><a href={detail.scenario_link} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem'}}><Mi size='sm'>link</Mi> 시나리오 링크</a></div>}
      {detail.session_log_url && <div style={{marginBottom:6}}><a href={detail.session_log_url} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem'}}><Mi size='sm'>save</Mi> 세션 로그 백업</a></div>}
      {(detail.extra_urls||[]).filter(u=>u.url).map((u,i)=>(
        <div key={i} style={{marginBottom:6}}><a href={u.url} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem'}}><Mi size='sm'>link</Mi> {u.label||'링크'}</a></div>
      ))}
      <SpoilerBlock detail={detail} isOwner={!!isOwner}/>
    </div>
  )
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
  const [search, setSearch] = useState('')
  const [ruleFilter, setRuleFilter] = useState('all')
  const [showSpoilerPw, setShowSpoilerPw] = useState(false)

  const load = async () => {
    const {data} = await supabase
      .from('play_logs').select('*').eq('user_id', user.id)
      .order('played_date', { ascending: false, nullsFirst: false })
    setItems(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const openNew = () => { setEditing(null); setForm({...BLANK,played_date:getTodayKST()}); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item}); setModal(true) }

  const save = async () => {
    if (!form.title||!form.played_date) return
    if (editing) await playLogsApi.update(editing.id,cleanPayload(form))
    else {
      const { error } = await playLogsApi.create({...cleanPayload(form),user_id:user.id})
      if (handleStorageLimitError(error)) return
    }
    setModal(false); load()
    if (detail&&editing&&detail.id===editing.id) setDetail({...cleanPayload(form),id:editing.id})
  }
  const remove = async id => { await playLogsApi.remove(id); load(); setDetail(null) }


  const seriesList = useMemo(()=>[...new Set(items.map(i=>i.series_tag).filter(Boolean))].sort(),[items])
  const ruleList = useMemo(()=>[...new Set(items.map(i=>i.system_name).filter(Boolean))].sort(),[items])

  const filtered = items.filter(i=>{
    const ms=!search||i.title.includes(search)||i.system_name?.includes(search)||i.together_with?.includes(search)||i.series_tag?.includes(search)||i.memo?.includes(search)
    const mr=ruleFilter==='all'||i.system_name===ruleFilter
    return ms&&mr
  })

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filtered, 20)

  const relatedItems = detail?.series_tag
    ? items.filter(i=>i.series_tag===detail.series_tag&&i.id!==detail.id).sort((a,b)=>(a.played_date||'').localeCompare(b.played_date||''))
    : []

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>auto_stories</Mi>다녀온 기록</h1><p className="page-subtitle">플레이한 세션들의 소중한 기억을 남겨요</p></div>
        <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> 기록 추가</button>
      </div>

      <div style={{marginBottom:20}}>
        <input className="form-input" placeholder="🔍 제목, 룰, 시리즈로 검색..." value={search}
          onChange={e=>setSearch(e.target.value)} autoComplete="off"
          style={{maxWidth:320,marginBottom:ruleList.length>0?10:0}}/>
        {ruleList.length>0&&(
          <div className="flex gap-8" style={{flexWrap:'wrap',marginTop:8}}>
            <button className={`btn btn-sm ${ruleFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setRuleFilter('all')}>전체</button>
            {ruleList.map(r=><button key={r} className={`btn btn-sm ${ruleFilter===r?'btn-primary':'btn-outline'}`} onClick={()=>setRuleFilter(r)}>{r}</button>)}
          </div>
        )}
      </div>

      {loading?<LoadingSpinner/>:filtered.length===0
        ?<EmptyState icon="auto_stories" title="기록이 없어요" action={<button className="btn btn-primary" onClick={openNew}>기록 추가</button>}/>
        :<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(238px,1fr))',gap:13}}>
          {paged.map(item=>(
            <div key={item.id}
              style={{borderRadius:12,overflow:'hidden',cursor:'pointer',background:'var(--color-surface)',border:'1px solid var(--color-border)',boxShadow:'0 2px 12px var(--color-shadow)',transition:'transform 0.2s,box-shadow 0.2s',display:'flex',flexDirection:'column'}}
              onClick={()=>setDetail(item)}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.15)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
            >
              <div style={{position:'relative',paddingTop:'56.25%'}}>
                <div style={{position:'absolute',inset:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                  {item.session_image_url?<img src={item.session_image_url} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'3rem',opacity:0.2}}><Mi size="lg" color="light">auto_stories</Mi></span>}
                </div>
                {/* 그라디언트 오버레이 */}
                <div style={{position:'absolute',bottom:0,left:0,right:0,height:'65%',background:'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.3) 55%,transparent 100%)',pointerEvents:'none'}}/>
                {/* 태그칩 - 완전 불투명 */}
                <div style={{position:'absolute',bottom:8,left:8,right:8,display:'flex',gap:4,flexWrap:'wrap'}}>
                  {item.series_tag&&<TagChip type="series" label={item.series_tag}/>}
                  <TagChip type="role" label={item.role}/>
                  {item.system_name&&<TagChip type="rule" label={item.system_name}/>}
                </div>
              </div>
              <div style={{padding:'10px 12px 0',flex:1,display:'flex',flexDirection:'column'}}>
                <div style={{fontWeight:700,fontSize:'1rem',lineHeight:1.3,color:'var(--color-text)',marginBottom:8}}>{item.title}</div>
                <div style={{display:'flex',flexDirection:'column',gap:1}}>
                  {(item.together_with||item.character_name)&&(
                    <div style={{fontSize:'0.79rem',color:'var(--color-text-light)',display:'flex',gap:12,flexWrap:'wrap'}}>
                      {item.together_with&&<span><span style={{fontWeight:600,marginRight:4}}>GM.</span>{item.together_with}</span>}
                      {item.character_name&&<span><span style={{fontWeight:600,marginRight:4}}>PL.</span>{item.character_name}</span>}
                    </div>
                  )}
                  {item.npc&&<div style={{fontSize:'0.79rem',color:'var(--color-text-light)'}}><span style={{fontWeight:600,marginRight:4}}>등장인물.</span>{item.npc}</div>}
                  {(item.start_date||item.played_date)&&(
                    <div style={{fontSize:'0.79rem',color:'var(--color-text-light)',display:'flex',gap:14,flexWrap:'wrap'}}>
                      {item.start_date&&<span><span style={{fontWeight:600,marginRight:4}}>Start.</span>{format(new Date(item.start_date),'yyyy.MM.dd')}</span>}
                      {item.played_date&&<span><span style={{fontWeight:600,marginRight:4}}>End.</span>{format(new Date(item.played_date),'yyyy.MM.dd')}</span>}
                    </div>
                  )}
                </div>

                {item.spoiler_content&&<div style={{marginTop:3,fontSize:'0.75rem',color:'#e57373'}}><Mi size='sm' color='danger'>warning</Mi> 스포일러 포함</div>}
                {item.is_private&&<div style={{marginTop:3,fontSize:'0.75rem',color:'var(--color-text-light)'}}><Mi size='sm' color='light'>lock</Mi> 비공개</div>}
              </div>
              <div style={{padding:'8px 12px 10px',marginTop:8,borderTop:'1px solid var(--color-border)',display:'flex',gap:5,justifyContent:'flex-end'}} onClick={e=>e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
          <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
        </>
      }

      {/* 상세 보기 */}
      <Modal isOpen={!!detail} onClose={()=>setDetail(null)} title={detail?.title}
        footer={<div className="flex justify-between w-full"><button className="btn btn-outline btn-sm" onClick={()=>{openEdit(detail);setDetail(null)}}>수정</button><button className="btn btn-outline btn-sm" onClick={()=>setDetail(null)}>닫기</button></div>}
      >
        {detail&&(
          <div>
            <LogDetailContent detail={detail} isOwner={true}/>
            {relatedItems.length>0&&(
              <div style={{borderTop:'1px solid var(--color-border)',paddingTop:14,marginTop:14}}>
                <div style={{fontWeight:700,fontSize:'0.82rem',color:'var(--color-accent)',marginBottom:10}}><Mi size="sm">auto_stories</Mi> {detail.series_tag} 시리즈의 다른 기록 ({relatedItems.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {relatedItems.map(r=>(
                    <div key={r.id} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',borderRadius:8,background:'var(--color-nav-active-bg)',cursor:'pointer'}} onClick={()=>setDetail(r)}>
                      <div style={{width:44,height:44,borderRadius:6,overflow:'hidden',flexShrink:0,background:'var(--color-border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {r.session_image_url?<img src={r.session_image_url} alt={r.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.2rem',opacity:0.4}}><Mi size="lg" color="light">auto_stories</Mi></span>}
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

      {/* 등록/수정 모달 */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'기록 수정':'기록 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div autoComplete="off">
          <div className="form-group"><label className="form-label">제목 (시나리오명) *</label><input className="form-input" autoComplete="off" value={form.title} onChange={set('title')}/></div>

          {/* 시작날짜 + 엔딩날짜 */}
          <div className="grid-2">
            <div className="form-group"><label className="form-label">시작 날짜</label><input className="form-input" type="date" autoComplete="off" value={form.start_date||''} onChange={set('start_date')}/></div>
            <div className="form-group"><label className="form-label">엔딩 날짜 *</label><input className="form-input" type="date" autoComplete="off" value={form.played_date||''} onChange={set('played_date')}/></div>
          </div>

          {/* 룰 + 역할 */}
          <div className="grid-2">
            <div className="form-group"><label className="form-label">룰</label><RuleSelect value={form.system_name} onChange={v=>setForm(f=>({...f,system_name:v}))}/></div>
            <div className="form-group"><label className="form-label">역할</label><select className="form-select" value={form.role} onChange={set('role')}><option value="PL">PL</option><option value="GM">GM</option></select></div>
          </div>

          {/* GM / PL */}
          <div className="grid-2">
            <div className="form-group"><label className="form-label">GM</label><input className="form-input" autoComplete="off" placeholder="닉네임" value={form.together_with||''} onChange={set('together_with')}/></div>
            <div className="form-group"><label className="form-label">PL</label><input className="form-input" autoComplete="off" placeholder="플레이어" value={form.character_name||''} onChange={set('character_name')}/></div>
          </div>

          {/* 등장인물 */}
          <div className="form-group"><label className="form-label">등장인물</label><input className="form-input" autoComplete="off" placeholder="주요 등장인물, NPC 등..." value={form.npc||''} onChange={set('npc')}/></div>



          {/* 시리즈 태그 */}
          <div className="form-group">
            <label className="form-label">시리즈 / 캠페인 태그</label>
            <input className="form-input" autoComplete="off" placeholder="예: 황혼의 왕관..." value={form.series_tag||''} onChange={set('series_tag')}/>
            {seriesList.length>0&&<div style={{marginTop:6,display:'flex',gap:5,flexWrap:'wrap'}}><span className="text-xs text-light" style={{alignSelf:'center'}}>기존:</span>{seriesList.map(s=><button key={s} type="button" className="btn btn-outline btn-sm" style={{fontSize:'0.7rem',padding:'2px 8px'}} onClick={()=>setForm(f=>({...f,series_tag:s}))}>{s}</button>)}</div>}
          </div>

          {/* 세션카드 이미지 */}
          <div className="form-group">
            <label className="form-label">세션카드 이미지 <span style={{fontWeight:400,color:'var(--color-text-light)',fontSize:'0.78rem'}}>(권장: 16:9, 800×450px)</span></label>
            <input className="form-input" autoComplete="off" placeholder="https://... (imgur 주소 등록 추천)" value={form.session_image_url||''} onChange={set('session_image_url')}/>
            {form.session_image_url&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}><img src={form.session_image_url} alt="preview" style={{width:60,height:34,objectFit:'cover',borderRadius:5,border:'1px solid var(--color-border)'}}/><button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,session_image_url:''}))}>제거</button></div>}
          </div>

          <div className="form-group"><label className="form-label">시나리오 링크 URL</label><input className="form-input" autoComplete="off" placeholder="https://..." value={form.scenario_link||''} onChange={set('scenario_link')}/></div>
          <div className="form-group"><label className="form-label">세션 로그 백업 URL</label><input className="form-input" autoComplete="off" placeholder="https://..." value={form.session_log_url||''} onChange={set('session_log_url')}/></div>

          {/* 추가 URL */}
          <div className="form-group">
            <label className="form-label">추가 URL</label>
            {(form.extra_urls||[]).map((u,i)=>(
              <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                <input className="form-input" placeholder="링크 이름" value={u.label||''} style={{flex:'0 0 110px'}}
                  onChange={e=>setForm(f=>({...f,extra_urls:f.extra_urls.map((x,j)=>j===i?{...x,label:e.target.value}:x)}))}/>
                <input className="form-input" placeholder="https://..." value={u.url||''} style={{flex:1}}
                  onChange={e=>setForm(f=>({...f,extra_urls:f.extra_urls.map((x,j)=>j===i?{...x,url:e.target.value}:x)}))}/>
                <button type="button" className="btn btn-ghost btn-sm" style={{color:'#e57373',flexShrink:0}}
                  onClick={()=>setForm(f=>({...f,extra_urls:f.extra_urls.filter((_,j)=>j!==i)}))}>
                  <Mi size='sm'>close</Mi>
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" style={{marginTop:2}}
              onClick={()=>setForm(f=>({...f,extra_urls:[...(f.extra_urls||[]),{label:'',url:''}]}))}>
              <Mi size='sm'>add</Mi> URL 추가
            </button>
          </div>

          <div className="form-group"><label className="form-label">메모</label><textarea className="form-textarea" autoComplete="off" value={form.memo||''} onChange={set('memo')}/></div>

          {/* 스포일러 섹션 */}
          <div style={{marginTop:8,padding:14,borderRadius:8,border:'1px solid rgba(229,115,115,0.3)',background:'rgba(229,115,115,0.04)'}}>
            <div style={{fontWeight:700,fontSize:'0.82rem',color:'#c62828',marginBottom:10}}><Mi size='sm' color='danger'>warning</Mi> 스포일러 내용 (선택)</div>
            <div className="form-group">
              <label className="form-label">스포일러 내용</label>
              <textarea className="form-textarea" autoComplete="off" name="spoiler_txt"
                placeholder="비밀번호를 알아야만 열람할 수 있어요."
                value={form.spoiler_content||''} onChange={set('spoiler_content')} style={{minHeight:80}}/>
            </div>
            {form.spoiler_content&&(
              <div className="form-group">
                <label className="form-label">스포일러 비밀번호</label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input className="form-input" autoComplete="new-password" name="spl_pw"
                    type={showSpoilerPw?'text':'password'}
                    placeholder="열람용 비밀번호 설정"
                    value={form.spoiler_password||''} onChange={set('spoiler_password')} style={{flex:1}}/>
                  <button type="button" onClick={()=>setShowSpoilerPw(v=>!v)}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',padding:'4px',color:'var(--color-text-light)',flexShrink:0}}>
                    {showSpoilerPw ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.spoiler_password&&<div className="text-xs text-light" style={{marginTop:4}}>현재 비밀번호: {showSpoilerPw?form.spoiler_password:'•'.repeat(form.spoiler_password.length)}</div>}
              </div>
            )}
          </div>
          {/* 공개 설정 */}
          <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--color-border)'}}>
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',userSelect:'none'}}>
              <input type="checkbox" checked={!!form.is_private}
                onChange={e=>setForm(f=>({...f,is_private:e.target.checked}))}
                style={{width:16,height:16,accentColor:'var(--color-primary)',cursor:'pointer'}}/>
              <Mi size="sm" color="light">lock</Mi>
              <span style={{fontSize:'0.88rem',fontWeight:600}}>비공개</span>
              <span style={{fontSize:'0.75rem',color:'var(--color-text-light)'}}>공개 페이지에 노출되지 않아요</span>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 기록을 삭제하시겠어요?"/>
    </div>
  )
}
