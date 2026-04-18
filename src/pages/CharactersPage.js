// src/pages/CharactersPage.js
import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog, TagManager, Pagination } from '../components/Layout'
import { usePagination } from '../hooks/usePagination'
import { Mi } from '../components/Mi'
import { format } from 'date-fns'

// 다녀온 기록 칩 (PairsPage 동일)
const TAG_COLORS = {
  series:  { bg:'#c8a96e', color:'#fff', border:'#b8944e' },
  role_PL: { bg:'#4a7ad4', color:'#fff', border:'#3a6ac4' },
  role_GM: { bg:'#7a5ab8', color:'#fff', border:'#6a4aa8' },
  rule:    { bg:'#5a8a40', color:'#fff', border:'#4a7a30' },
}
function TagChip({ type, label }) {
  const c = type==='series' ? TAG_COLORS.series : type==='role' ? (label==='GM' ? TAG_COLORS.role_GM : TAG_COLORS.role_PL) : TAG_COLORS.rule
  return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:100,fontSize:'0.63rem',fontWeight:700,background:c.bg,color:c.color,border:`1px solid ${c.border}`,whiteSpace:'nowrap'}}>{label}</span>
}

// PC 룰 태그 칩 (보라)
function RuleChip({ label }) {
  return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:100,fontSize:'0.63rem',fontWeight:700,background:'#7a5ab8',color:'#fff',border:'1px solid #6a4aa8',whiteSpace:'nowrap'}}>{label}</span>
}
// 상세 모달용 헬퍼
function InfoRow({ label, value }) {
  return (
    <div style={{background:'var(--color-nav-active-bg)',borderRadius:8,padding:'8px 12px'}}>
      <div style={{fontSize:'0.65rem',color:'var(--color-text-light)',marginBottom:2}}>{label}</div>
      <div style={{fontSize:'0.88rem',fontWeight:600}}>{value}</div>
    </div>
  )
}
function DetailSection({ label, value }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',fontWeight:600,marginBottom:4}}>{label}</div>
      <div style={{fontSize:'0.85rem',lineHeight:1.75,whiteSpace:'pre-wrap',color:'var(--color-text)'}}>{value}</div>
    </div>
  )
}

const BLANK = {
  name:'', age:'', gender:'', height_weight:'', job:'',
  personality:'', background:'', extra_settings:'', memo:'',
  image_url:'', rules:[], extra_urls:[]
}
const cleanPayload = f => {
  const { id, user_id, created_at, ...rest } = f
  return { ...rest, rules:f.rules||[], extra_urls:f.extra_urls||[] }
}

const LOG_SELECT = 'id,title,played_date,start_date,system_name,role,series_tag,session_image_url'
const HIST_SELECT = `id, play_log_id, character_id, play_logs(${LOG_SELECT})`

export function CharactersPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [ruleTags, setRuleTags] = useState([])
  const [tagModal, setTagModal] = useState(false)
  const [search, setSearch] = useState('')
  const [ruleFilter, setRuleFilter] = useState('all')
  const [detailChar, setDetailChar] = useState(null)

  // 히스토리
  const [historiesMap, setHistoriesMap] = useState({})
  const [historyModal, setHistoryModal] = useState(null)   // character_id
  const [historySearch, setHistorySearch] = useState('')
  const [allLogs, setAllLogs] = useState([])
  const [logsLoaded, setLogsLoaded] = useState(false)
  const [historyViewChar, setHistoryViewChar] = useState(null)
  const [historyViewSearch, setHistoryViewSearch] = useState('')
  const [historyViewPage, setHistoryViewPage] = useState(1)

  const load = async () => {
    const { data } = await supabase.from('characters').select('*')
      .eq('user_id', user.id).order('created_at', {ascending:false}).limit(2500)
    const chars = data || []
    setItems(chars)
    setLoading(false)
    // 히스토리 전체 pre-load → 카운트 즉시 표시
    const { data: hData } = await supabase.from('character_histories').select(HIST_SELECT)
      .eq('user_id', user.id).order('created_at', {ascending:false})
    const map = {}
    chars.forEach(c => { map[c.id] = [] })
    ;(hData||[]).forEach(r => {
      if (!map[r.character_id]) map[r.character_id] = []
      map[r.character_id].push({history_id:r.id, ...r.play_logs})
    })
    setHistoriesMap(map)
  }
  const loadRuleTags = async () => {
    const { data } = await supabase.from('character_rule_tags').select('*').eq('user_id', user.id).order('name')
    setRuleTags(data||[])
  }
  const loadHistories = async (charId) => {
    const { data } = await supabase.from('character_histories').select(HIST_SELECT)
      .eq('character_id', charId).order('created_at', {ascending:false})
    setHistoriesMap(m => ({...m, [charId]: (data||[]).map(r => ({history_id:r.id, ...r.play_logs}))}))
  }
  const loadAllLogs = async () => {
    if (logsLoaded) return
    const { data } = await supabase.from('play_logs').select(LOG_SELECT)
      .eq('user_id', user.id).order('played_date', {ascending:false}).limit(2500)
    setAllLogs(data||[])
    setLogsLoaded(true)
  }

  useEffect(() => { load(); loadRuleTags() }, [user]) // eslint-disable-line

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))
  const toggleRule = tag => setForm(f => ({
    ...f, rules: (f.rules||[]).includes(tag) ? f.rules.filter(r=>r!==tag) : [...(f.rules||[]), tag]
  }))
  const openNew = () => { setEditing(null); setForm(BLANK); setModal(true) }
  const openEdit = item => { setEditing(item); setForm({...item, rules:item.rules||[], extra_urls:item.extra_urls||[]}); setModal(true) }

  const save = async () => {
    if (!form.name) return
    if (!editing && items.length >= 2500) { alert('게시판의 최대 등록 갯수를 초과하여 저장할 수 없습니다. PC 목록을 정리해주세요.'); return }
    const validTagNames = ruleTags.map(t=>t.name)
    const cleanedRules = (form.rules||[]).filter(r=>validTagNames.includes(r))
    const payload = cleanPayload({...form, rules:cleanedRules})
    if (editing) await supabase.from('characters').update(payload).eq('id', editing.id)
    else await supabase.from('characters').insert({...payload, user_id:user.id})
    setModal(false); load()
  }
  const remove = async id => { await supabase.from('characters').delete().eq('id', id); load() }

  // 태그 관리
  const addTag = async name => { await supabase.from('character_rule_tags').insert({user_id:user.id, name}); loadRuleTags() }
  const editTag = async (id, name) => {
    const oldTag = ruleTags.find(t=>t.id===id)?.name
    if (oldTag) {
      const affected = items.filter(i=>i.rules?.includes(oldTag))
      for (const item of affected) {
        await supabase.from('characters').update({rules:item.rules.map(r=>r===oldTag?name:r)}).eq('id', item.id)
      }
    }
    await supabase.from('character_rule_tags').update({name}).eq('id', id)
    load(); loadRuleTags()
  }
  const removeTag = async id => {
    const tagName = ruleTags.find(t=>t.id===id)?.name
    if (tagName) {
      const affected = items.filter(i=>i.rules?.includes(tagName))
      for (const item of affected) {
        await supabase.from('characters').update({rules:item.rules.filter(r=>r!==tagName)}).eq('id', item.id)
      }
    }
    await supabase.from('character_rule_tags').delete().eq('id', id)
    load(); loadRuleTags()
  }

  // 히스토리
  const openHistoryView = async (char) => {
    setHistoryViewChar(char)
    setHistoryViewSearch('')
    setHistoryViewPage(1)
    await loadHistories(char.id)
  }
  const openHistoryModal = async (charId) => {
    await loadAllLogs()
    setHistorySearch('')
    setHistoryModal(charId)
  }
  const addHistory = async (charId, logId) => {
    await supabase.from('character_histories').insert({user_id:user.id, character_id:charId, play_log_id:logId})
    await loadHistories(charId)
  }
  const removeHistory = async (charId, historyId) => {
    await supabase.from('character_histories').delete().eq('id', historyId)
    setHistoriesMap(m => ({...m, [charId]:(m[charId]||[]).filter(h=>h.history_id!==historyId)}))
  }

  // 검색 + 필터
  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return items.filter(i => {
      if (ruleFilter !== 'all' && !(i.rules||[]).includes(ruleFilter)) return false
      if (!s) return true
      return (
        (i.name||'').toLowerCase().includes(s) ||
        (i.age||'').toLowerCase().includes(s) ||
        (i.gender||'').toLowerCase().includes(s) ||
        (i.height_weight||'').toLowerCase().includes(s) ||
        (i.job||'').toLowerCase().includes(s) ||
        (i.personality||'').toLowerCase().includes(s) ||
        (i.background||'').toLowerCase().includes(s) ||
        (i.extra_settings||'').toLowerCase().includes(s) ||
        (i.memo||'').toLowerCase().includes(s) ||
        (i.rules||[]).some(r=>r.toLowerCase().includes(s))
      )
    })
  }, [items, search, ruleFilter])

  const { paged, page, setPage, perPage, setPerPage } = usePagination(filtered, 20)

  // 히스토리 뷰 필터링
  const historyViewLogs = useMemo(() => {
    if (!historyViewChar) return []
    const s = historyViewSearch.toLowerCase()
    const list = historiesMap[historyViewChar.id] || []
    if (!s) return list
    return list.filter(h =>
      (h.title||'').toLowerCase().includes(s) ||
      (h.system_name||'').toLowerCase().includes(s) ||
      (h.played_date||'').includes(s)
    )
  }, [historyViewChar, historyViewSearch, historiesMap])
  const HV_PER_PAGE = 10
  const hvTotalPages = Math.ceil(historyViewLogs.length / HV_PER_PAGE) || 1
  const hvPaged = historyViewLogs.slice((historyViewPage-1)*HV_PER_PAGE, historyViewPage*HV_PER_PAGE)

  // 기록 연결 필터링
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

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:'middle'}}>person</Mi>PC 목록</h1>
          <p className="page-subtitle">나의 플레이어 캐릭터를 기록해요 ({items.length}명)</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline btn-sm" onClick={()=>setTagModal(true)}><Mi size='sm'>sell</Mi> 룰 태그 관리</button>
          <button className="btn btn-primary" onClick={openNew}><Mi size='sm' color='white'>add</Mi> PC 추가</button>
        </div>
      </div>

      {/* 검색 + 룰 필터 */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <input className="form-input" style={{flex:'1 1 200px',maxWidth:340}} placeholder="🔍 이름, 직업, 성격, 배경 등 검색..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
        {ruleTags.length>0&&(
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <button className={`btn btn-sm ${ruleFilter==='all'?'btn-primary':'btn-outline'}`} onClick={()=>setRuleFilter('all')}>전체</button>
            {ruleTags.map(t=>(
              <button key={t.id} className={`btn btn-sm ${ruleFilter===t.name?'btn-primary':'btn-outline'}`} onClick={()=>setRuleFilter(t.name)}>{t.name}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner/> : filtered.length===0
        ? <EmptyState icon="person" title="PC가 없어요" action={<button className="btn btn-primary" onClick={openNew}>추가하기</button>}/>
        : <>
          <div className="grid-auto">
            {paged.map(item => {
              const validTagNames = ruleTags.map(t=>t.name)
              const displayRules = (item.rules||[]).filter(r=>validTagNames.includes(r))
              return (
                <div key={item.id} className="card" style={{padding:0,overflow:'hidden'}}>
                  {/* 두상 이미지 — 1:1 */}
                  <div style={{position:'relative',width:'100%',paddingTop:'100%',background:'var(--color-nav-active-bg)',overflow:'hidden',cursor:'pointer'}}
                    onClick={()=>setDetailChar(item)}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                      : <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'4rem',opacity:0.25}}>🧑</span></div>
                    }
                  </div>
                  {/* 카드 정보 — 클릭 시 상세 팝업 */}
                  <div style={{padding:'12px 14px',cursor:'pointer'}} onClick={()=>setDetailChar(item)}>
                    <div style={{fontWeight:700,fontSize:'1rem',marginBottom:3}}>{item.name}</div>
                    {(item.age||item.gender||item.job)&&(
                      <div className="text-xs text-light" style={{marginBottom:5}}>
                        {[item.age&&`${item.age}세`, item.gender, item.job].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {displayRules.length>0&&(
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:5}}>
                        {displayRules.map(r=><RuleChip key={r} label={r}/>)}
                      </div>
                    )}
                    {item.memo&&(
                      <p className="text-xs text-light" style={{marginTop:6,borderTop:'1px solid var(--color-border)',paddingTop:6,overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                        {item.memo}
                      </p>
                    )}
                  </div>
                  <div style={{padding:'8px 14px',borderTop:'1px solid var(--color-border)',display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button className="btn btn-ghost btn-sm" style={{marginRight:'auto'}} onClick={e=>{e.stopPropagation();openHistoryView(item)}}>
                      <Mi size='sm'>history</Mi> 히스토리{historiesMap[item.id]?.length>0&&` (${historiesMap[item.id].length})`}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();openEdit(item)}}>수정</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={e=>{e.stopPropagation();setConfirm(item.id)}}>삭제</button>
                  </div>
                </div>
              )
            })}
          </div>
          <Pagination total={filtered.length} perPage={perPage} page={page} onPage={setPage} onPerPage={setPerPage}/>
        </>
      }

      {/* ── 추가/수정 모달 ── */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'PC 수정':'PC 추가'}
        footer={<><button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button><button className="btn btn-primary btn-sm" onClick={save}>저장</button></>}
      >
        {/* 두상 이미지 */}
        <div className="form-group">
          <label className="form-label">두상 이미지 <span style={{fontWeight:400,color:'var(--color-text-light)',fontSize:'0.78rem'}}>(권장: 1:1 또는 3:4 비율)</span></label>
          <input className="form-input" placeholder="https://... (이미지 URL)" value={form.image_url||''} onChange={set('image_url')}/>
          {form.image_url&&(
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <img src={form.image_url} alt="preview" style={{width:52,height:52,objectFit:'cover',borderRadius:8,border:'1px solid var(--color-border)'}}/>
              <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,image_url:''}))}>제거</button>
            </div>
          )}
        </div>
        {/* 이름 */}
        <div className="form-group">
          <label className="form-label">이름 *</label>
          <input className="form-input" value={form.name} onChange={set('name')} placeholder="캐릭터 이름"/>
        </div>
        {/* 나이·성별 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-group">
            <label className="form-label">나이</label>
            <input className="form-input" value={form.age||''} onChange={set('age')} placeholder="예: 24"/>
          </div>
          <div className="form-group">
            <label className="form-label">성별</label>
            <input className="form-input" value={form.gender||''} onChange={set('gender')} placeholder="예: 여성"/>
          </div>
        </div>
        {/* 키/몸무게·직업 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-group">
            <label className="form-label">키/몸무게</label>
            <input className="form-input" value={form.height_weight||''} onChange={set('height_weight')} placeholder="예: 162cm / 52kg"/>
          </div>
          <div className="form-group">
            <label className="form-label">직업</label>
            <input className="form-input" value={form.job||''} onChange={set('job')} placeholder="예: 탐정"/>
          </div>
        </div>
        {/* 성격 */}
        <div className="form-group">
          <label className="form-label">성격</label>
          <textarea className="form-textarea" value={form.personality||''} onChange={set('personality')} style={{minHeight:70}} placeholder="캐릭터의 성격을 적어주세요"/>
        </div>
        {/* 배경 */}
        <div className="form-group">
          <label className="form-label">배경</label>
          <textarea className="form-textarea" value={form.background||''} onChange={set('background')} style={{minHeight:70}} placeholder="캐릭터의 배경을 적어주세요"/>
        </div>
        {/* 기타설정 */}
        <div className="form-group">
          <label className="form-label">기타설정</label>
          <textarea className="form-textarea" value={form.extra_settings||''} onChange={set('extra_settings')} style={{minHeight:70}} placeholder="외형, 특기, 소지품 등 기타 설정"/>
        </div>
        {/* 메모 */}
        <div className="form-group">
          <label className="form-label">메모</label>
          <textarea className="form-textarea" value={form.memo||''} onChange={set('memo')} style={{minHeight:70}}/>
        </div>
        {/* 룰 태그 */}
        <div className="form-group">
          <label className="form-label">룰
            <button type="button" className="btn btn-ghost btn-sm" style={{marginLeft:8,fontSize:'0.68rem'}} onClick={()=>setTagModal(true)}>+ 태그 관리</button>
          </label>
          {ruleTags.length===0
            ? <div className="text-xs text-light">룰 태그가 없어요. 태그 관리에서 추가해주세요.</div>
            : <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {ruleTags.map(tag=>(
                  <button key={tag.id} type="button"
                    className={`btn btn-sm ${(form.rules||[]).includes(tag.name)?'btn-primary':'btn-outline'}`}
                    onClick={()=>toggleRule(tag.name)}>{tag.name}</button>
                ))}
              </div>
          }
        </div>
        {/* 기타 URL */}
        <div className="form-group">
          <label className="form-label">기타 URL</label>
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
      </Modal>

      {/* ── 룰 태그 관리 모달 ── */}
      <Modal isOpen={tagModal} onClose={()=>setTagModal(false)} title="🏷️ 룰 태그 관리"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setTagModal(false)}>닫기</button>}
      >
        <TagManager tags={ruleTags} onAdd={addTag} onEdit={editTag} onRemove={removeTag} placeholder="CoC, D&D, 신화기계..."/>
      </Modal>

      {/* ── 상세 보기 모달 ── */}
      <Modal isOpen={!!detailChar} onClose={()=>setDetailChar(null)} title={detailChar?.name||'PC 상세'}
        footer={
          <div style={{display:'flex',gap:8,width:'100%',justifyContent:'space-between'}}>
            <button className="btn btn-outline btn-sm" onClick={()=>openHistoryView(detailChar)}>
              <Mi size='sm'>history</Mi> 히스토리{historiesMap[detailChar?.id]?.length>0&&` (${historiesMap[detailChar.id].length})`}
            </button>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline btn-sm" onClick={()=>{setDetailChar(null);setTimeout(()=>openEdit(detailChar),50)}}>수정</button>
              <button className="btn btn-outline btn-sm" onClick={()=>setDetailChar(null)}>닫기</button>
            </div>
          </div>
        }
      >
        {detailChar&&<>
          {/* 이미지 */}
          {detailChar.image_url&&(
            <div style={{width:'100%',aspectRatio:'1/1',maxHeight:260,overflow:'hidden',borderRadius:12,marginBottom:16,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <img src={detailChar.image_url} alt={detailChar.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
          )}
          {/* 기본 정보 그리드 */}
          {(detailChar.age||detailChar.gender||detailChar.height_weight||detailChar.job)&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
              {detailChar.age&&<InfoRow label="나이" value={`${detailChar.age}세`}/>}
              {detailChar.gender&&<InfoRow label="성별" value={detailChar.gender}/>}
              {detailChar.height_weight&&<InfoRow label="키/몸무게" value={detailChar.height_weight}/>}
              {detailChar.job&&<InfoRow label="직업" value={detailChar.job}/>}
            </div>
          )}
          {/* 룰 태그 */}
          {detailChar.rules?.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',fontWeight:600,marginBottom:6}}>룰</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {detailChar.rules.map(r=><RuleChip key={r} label={r}/>)}
              </div>
            </div>
          )}
          {/* 텍스트 섹션 */}
          {detailChar.personality&&<DetailSection label="성격" value={detailChar.personality}/>}
          {detailChar.background&&<DetailSection label="배경" value={detailChar.background}/>}
          {detailChar.extra_settings&&<DetailSection label="기타설정" value={detailChar.extra_settings}/>}
          {detailChar.memo&&<DetailSection label="메모" value={detailChar.memo}/>}
          {/* 기타 URL */}
          {(detailChar.extra_urls||[]).filter(u=>u.url).length>0&&(
            <div style={{marginTop:4}}>
              <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',fontWeight:600,marginBottom:6}}>링크</div>
              {(detailChar.extra_urls||[]).filter(u=>u.url).map((u,i)=>(
                <div key={i} style={{marginBottom:6}}>
                  <a href={u.url} target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',fontSize:'0.85rem',display:'inline-flex',alignItems:'center',gap:4}}>
                    <Mi size='sm'>link</Mi>{u.label||'링크'}
                  </a>
                </div>
              ))}
            </div>
          )}
        </>}
      </Modal>

      {/* ── 삭제 확인 ── */}
      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 PC를 삭제하시겠어요?"/>

      {/* ── 히스토리 뷰 모달 ── */}
      <Modal isOpen={!!historyViewChar} onClose={()=>setHistoryViewChar(null)} title={`${historyViewChar?.name||''} 히스토리`}
        footer={
          <div style={{display:'flex',gap:8,width:'100%',justifyContent:'space-between'}}>
            <button className="btn btn-outline btn-sm" onClick={()=>openHistoryModal(historyViewChar?.id)}>
              <Mi size='sm'>add</Mi> 기록 연결
            </button>
            <button className="btn btn-outline btn-sm" onClick={()=>setHistoryViewChar(null)}>닫기</button>
          </div>
        }
      >
        <input className="form-input" placeholder="🔍 제목, 시리즈, 룰, 날짜 검색..."
          value={historyViewSearch} onChange={e=>{setHistoryViewSearch(e.target.value);setHistoryViewPage(1)}} style={{marginBottom:12}}/>
        {historyViewChar && historiesMap[historyViewChar.id]===undefined
          ? <div className="text-xs text-light" style={{textAlign:'center',padding:'24px 0'}}>로딩 중...</div>
          : historyViewLogs.length===0
            ? <div className="text-xs text-light" style={{textAlign:'center',padding:'24px 0'}}>연결된 기록이 없어요.</div>
            : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {hvPaged.map(h=>(
                  <div key={h.history_id} style={{display:'flex',gap:10,alignItems:'center',padding:'10px',borderRadius:10,border:'1px solid var(--color-border)',background:'var(--color-surface)'}}>
                    <div style={{width:56,height:56,borderRadius:7,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {h.session_image_url?<img src={h.session_image_url} alt={h.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Mi size="lg" color="light">auto_stories</Mi>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4}}>{h.title||'(제목 없음)'}</div>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:3}}>
                        {h.series_tag && <TagChip type="series" label={h.series_tag}/>}
                        {h.role && <TagChip type="role" label={h.role}/>}
                        {h.system_name && <TagChip type="rule" label={h.system_name}/>}
                      </div>
                      <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',display:'flex',gap:8,flexWrap:'wrap'}}>
                        {h.start_date && <span>Start. {format(new Date(h.start_date),'yyyy.MM.dd')}</span>}
                        {h.played_date && <span>End. {format(new Date(h.played_date),'yyyy.MM.dd')}</span>}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373',flexShrink:0,padding:'4px 6px'}}
                      onClick={()=>removeHistory(historyViewChar.id, h.history_id)}>
                      <Mi size='sm'>close</Mi>
                    </button>
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

      {/* ── 기록 연결 모달 ── */}
      <Modal isOpen={!!historyModal} onClose={()=>setHistoryModal(null)} title="기록 연결"
        footer={<button className="btn btn-outline btn-sm" onClick={()=>setHistoryModal(null)}>닫기</button>}
      >
        <input className="form-input" placeholder="🔍 제목, 시리즈, 룰, 날짜 검색..."
          value={historySearch} onChange={e=>setHistorySearch(e.target.value)} style={{marginBottom:12}}/>
        {filteredLogs.length===0
          ? <div className="text-xs text-light" style={{textAlign:'center',padding:'24px 0'}}>연결할 기록이 없어요.</div>
          : <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:400,overflowY:'auto'}}>
              {filteredLogs.map(l=>(
                <div key={l.id} style={{display:'flex',gap:10,alignItems:'center',padding:'10px',borderRadius:10,border:'1px solid var(--color-border)',background:'var(--color-surface)'}}>
                  <div style={{width:56,height:56,borderRadius:7,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {l.session_image_url?<img src={l.session_image_url} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Mi size="lg" color="light">auto_stories</Mi>}
                  </div>
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
                  <button className="btn btn-primary btn-sm" style={{flexShrink:0}}
                    onClick={async()=>{await addHistory(historyModal,l.id);setHistoryModal(null)}}>연결</button>
                </div>
              ))}
            </div>
        }
      </Modal>
    </div>
  )
}
