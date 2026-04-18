// src/pages/PairsPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { pairsApi, supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { format } from 'date-fns'

// PlayLogPage와 동일한 TagChip
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

const BLANK = { name:'', nickname:'', memo:'', relations:[], first_met_date:'', pair_image_url:'' }
const cleanPayload = f => { const { id, user_id, created_at, ...rest } = f; return {...rest, first_met_date:f.first_met_date||null, relations:f.relations||[]} }
function calcDday(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date()-new Date(dateStr))/(1000*60*60*24)) + 1
}

const SORT_KEY = 'trpg_pair_sort_order'

export function PairsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [relationTags, setRelationTags] = useState([])
  const [tagModal, setTagModal] = useState(false)
  const [tagFilter, setTagFilter] = useState('all')
  // localStorage에서 초기값 로드
  const [sortOrder, setSortOrderState] = useState(() => localStorage.getItem(SORT_KEY) || 'asc')
  // 페어 히스토리
  const [historiesMap, setHistoriesMap] = useState({}) // pair_id → [{history_id, ...play_log}]
  const [historyModal, setHistoryModal] = useState(null) // pair_id | null (기록 연결 모달)
  const [historySearch, setHistorySearch] = useState('')
  const [allLogs, setAllLogs] = useState([])
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [historyViewPair, setHistoryViewPair] = useState(null) // 히스토리 뷰 모달
  const [historyViewSearch, setHistoryViewSearch] = useState('')
  const [historyViewPage, setHistoryViewPage] = useState(1)

  // 정렬 변경 시 localStorage + Supabase 동시 저장
  const setSortOrder = async (order) => {
    setSortOrderState(order)
    localStorage.setItem(SORT_KEY, order)
    if (user?.id) {
      await supabase.from('profiles').update({ pair_sort_order: order }).eq('id', user.id)
    }
  }

  const LOG_SELECT = 'id,title,played_date,start_date,system_name,role,series_tag,session_image_url,together_with,character_name'
  const HIST_SELECT = `id, play_log_id, pair_id, play_logs(${LOG_SELECT})`

  const load = async () => {
    const {data} = await pairsApi.getAll(user.id)
    const pairs = data || []
    setItems(pairs)
    setLoading(false)
    // 히스토리 전체 pre-load → 카운트 즉시 표시
    const {data: hData} = await supabase.from('pair_histories').select(HIST_SELECT)
      .eq('user_id', user.id).order('created_at', {ascending:false})
    const map = {}
    pairs.forEach(p => { map[p.id] = [] }) // 카운트 0인 페어도 즉시 표시
    ;(hData||[]).forEach(r => {
      if (!map[r.pair_id]) map[r.pair_id] = []
      map[r.pair_id].push({history_id:r.id, ...r.play_logs})
    })
    setHistoriesMap(map)
  }
  const loadTags = async () => {
    const {data}=await supabase.from('pair_relations').select('*').eq('user_id',user.id).order('name')
    setRelationTags(data||[])
  }
  const loadHistories = async (pairId) => {
    const {data}=await supabase.from('pair_histories').select(HIST_SELECT).eq('pair_id',pairId).order('created_at',{ascending:false})
    setHistoriesMap(m=>({...m,[pairId]:(data||[]).map(r=>({history_id:r.id,...r.play_logs}))}))
  }
  const loadAllLogs = async () => {
    if (logsLoaded) return
    const {data}=await supabase.from('play_logs').select(LOG_SELECT).eq('user_id',user.id).order('played_date',{ascending:false}).limit(2500)
    setAllLogs(data||[])
    setLogsLoaded(true)
  }
  const openHistoryView = async (pair) => {
    setHistoryViewPair(pair)
    setHistoryViewSearch('')
    setHistoryViewPage(1)
    await loadHistories(pair.id) // 항상 최신 데이터로 갱신
  }
  const openHistoryModal = async (pairId) => {
    await loadAllLogs()
    setHistorySearch('')
    setHistoryModal(pairId)
  }
  const addHistory = async (pairId, logId) => {
    await supabase.from('pair_histories').insert({user_id:user.id,pair_id:pairId,play_log_id:logId})
    await loadHistories(pairId)
  }
  const removeHistory = async (pairId, historyId) => {
    await supabase.from('pair_histories').delete().eq('id',historyId)
    setHistoriesMap(m=>({...m,[pairId]:(m[pairId]||[]).filter(h=>h.history_id!==historyId)}))
  }
  useEffect(() => { load(); loadTags() }, [user]) // eslint-disable-line

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const toggleRelation = tag => setForm(f=>({...f,relations:f.relations?.includes(tag)?f.relations.filter(r=>r!==tag):[...(f.relations||[]),tag]}))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item,relations:item.relations||[]}); setModal(true) }
  const save = async () => {
    if (!form.name) return
    if (!editing && items.length >= 2500) { alert('게시판의 최대 등록 갯수를 초과하여 저장할 수 없습니다. 페어 목록을 정리해주세요.'); return }
    const validTagNames = relationTags.map(t=>t.name)
    const cleanedRelations = (form.relations||[]).filter(r=>validTagNames.includes(r))
    const payload = cleanPayload({...form,relations:cleanedRelations})
    if (editing) await pairsApi.update(editing.id,payload)
    else await pairsApi.create({...payload,user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await pairsApi.remove(id); load() }


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
      const noA=!a.first_met_date, noB=!b.first_met_date
      if (noA && noB) return sortOrder==='asc'?(a.name||'').localeCompare(b.name||'','ko'):(b.name||'').localeCompare(a.name||'','ko')
      if (noA) return 1
      if (noB) return -1
      return sortOrder==='asc'?da.localeCompare(db):db.localeCompare(da)
    })

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filtered, 20)

  const filteredLogs = useMemo(() => {
    if (!historyModal) return []
    const s = historySearch.toLowerCase()
    const linked = new Set((historiesMap[historyModal]||[]).map(h=>h.id))
    return allLogs.filter(l => {
      if (linked.has(l.id)) return false
      if (!s) return true
      return (l.title||'').toLowerCase().includes(s) || (l.system_name||'').toLowerCase().includes(s) || (l.played_date||'').includes(s)
    })
  }, [historySearch, allLogs, historyModal, historiesMap])

  const historyViewLogs = useMemo(() => {
    if (!historyViewPair) return []
    const s = historyViewSearch.toLowerCase()
    const list = historiesMap[historyViewPair.id] || []
    if (!s) return list
    return list.filter(h =>
      (h.title||'').toLowerCase().includes(s) ||
      (h.system_name||'').toLowerCase().includes(s) ||
      (h.played_date||'').includes(s)
    )
  }, [historyViewPair, historyViewSearch, historiesMap])
  const HV_PER_PAGE = 10
  const hvTotalPages = Math.ceil(historyViewLogs.length / HV_PER_PAGE) || 1
  const hvPaged = historyViewLogs.slice((historyViewPage-1)*HV_PER_PAGE, historyViewPage*HV_PER_PAGE)

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
        :<>
          <div className="grid-auto">
          {paged.map(item=>{
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
                  <button className="btn btn-ghost btn-sm" onClick={()=>openHistoryView(item)} style={{marginRight:'auto'}}>
                    <Mi size='sm'>history</Mi> 히스토리{historiesMap[item.id]?.length > 0 && ` (${historiesMap[item.id].length})`}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            )
          })}
        </div>
        <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
        </>
      }
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'페어 수정':'페어 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        <div className="form-group"><label className="form-label">페어명 *</label><input className="form-input" value={form.name} onChange={set('name')}/></div>
        <div className="form-group">
          <label className="form-label">페어 이미지 <span style={{fontWeight:400,color:'var(--color-text-light)',fontSize:'0.78rem'}}>(권장: 3:2 비율, 600×400px)</span></label>
          <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.pair_image_url||''} onChange={set('pair_image_url')}/>
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
      {/* 히스토리 뷰 모달 */}
      <Modal isOpen={!!historyViewPair} onClose={()=>setHistoryViewPair(null)} title={`${historyViewPair?.name || ''} 히스토리`}
        footer={
          <div style={{display:'flex',gap:8,width:'100%',justifyContent:'space-between'}}>
            <button className="btn btn-outline btn-sm" onClick={()=>openHistoryModal(historyViewPair?.id)}>
              <Mi size='sm'>add</Mi> 기록 연결
            </button>
            <button className="btn btn-outline btn-sm" onClick={()=>setHistoryViewPair(null)}>닫기</button>
          </div>
        }
      >
        <input className="form-input" placeholder="제목, 시스템, 날짜 검색..." value={historyViewSearch} onChange={e=>{setHistoryViewSearch(e.target.value);setHistoryViewPage(1)}} style={{marginBottom:10}}/>
        {historyViewPair && historiesMap[historyViewPair.id]===undefined
          ?<div className="text-xs text-light" style={{textAlign:'center',padding:'16px 0'}}>로딩 중...</div>
          :historyViewLogs.length===0
            ?<div className="text-xs text-light" style={{textAlign:'center',padding:'16px 0'}}>연결된 기록이 없어요.</div>
            :<div style={{display:'flex',flexDirection:'column',gap:4}}>
              {hvPaged.map(h=>(
                <div key={h.history_id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--color-border)'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.85rem',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.title||'(제목 없음)'}</div>
                    <div className="text-xs text-light">{h.played_date||''}{h.system_name?` · ${h.system_name}`:''}{h.role?` · ${h.role}`:''}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373',flexShrink:0,padding:'2px 4px'}} onClick={()=>removeHistory(historyViewPair.id,h.history_id)}><Mi size='sm'>close</Mi></button>
                </div>
              ))}
              {hvTotalPages>1&&(
                <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:8}}>
                  <button className="btn btn-ghost btn-sm" disabled={historyViewPage===1} onClick={()=>setHistoryViewPage(p=>p-1)}>‹</button>
                  <span className="text-xs text-light">{historyViewPage} / {hvTotalPages}</span>
                  <button className="btn btn-ghost btn-sm" disabled={historyViewPage===hvTotalPages} onClick={()=>setHistoryViewPage(p=>p+1)}>›</button>
                </div>
              )}
            </div>
        }
      </Modal>
      <Modal isOpen={!!historyModal} onClose={()=>setHistoryModal(null)} title="기록 연결"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setHistoryModal(null)}>닫기</button>}
      >
        <input className="form-input" placeholder="🔍 제목, 시리즈, 룰, 날짜 검색..." value={historySearch} onChange={e=>setHistorySearch(e.target.value)} style={{marginBottom:12}}/>
        {filteredLogs.length===0
          ?<div className="text-xs text-light" style={{textAlign:'center',padding:'24px 0'}}>연결할 기록이 없어요.</div>
          :<div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:400,overflowY:'auto'}}>
            {filteredLogs.map(l=>(
              <div key={l.id} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 10px',borderRadius:10,border:'1px solid var(--color-border)',background:'var(--color-surface)'}}>
                {/* 썸네일 */}
                <div style={{width:56,height:56,borderRadius:7,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  {l.session_image_url
                    ?<img src={l.session_image_url} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    :<Mi size="lg" color="light">auto_stories</Mi>
                  }
                </div>
                {/* 정보 */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4}}>{l.title||'(제목 없음)'}</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:3}}>
                    {l.series_tag && <TagChip type="series" label={l.series_tag}/>}
                    {l.role && <TagChip type="role" label={l.role}/>}
                    {l.system_name && <TagChip type="rule" label={l.system_name}/>}
                  </div>
                  <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',display:'flex',gap:8,flexWrap:'wrap'}}>
                    {l.start_date && <span>Start. {format(new Date(l.start_date),'yyyy.MM.dd')}</span>}
                    {l.played_date && <span>End. {format(new Date(l.played_date),'yyyy.MM.dd')}</span>}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" style={{flexShrink:0}} onClick={async()=>{await addHistory(historyModal,l.id);setHistoryModal(null)}}>연결</button>
              </div>
            ))}
          </div>
        }
      </Modal>
    </div>
  )
}
