// src/pages/SettingsPage.js
import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { updateProfile, supabase, recordFirstMembershipUse } from '../lib/supabase'
import { Mi } from '../components/Mi'

const PRESET_COLORS = [
  { name:'황토 다이어리', primary:'#c8a96e', bg:'#faf6f0', accent:'#8b6f47' },
  { name:'심야 블루', primary:'#6b8cba', bg:'#f0f2f8', accent:'#3a5a8c' },
  { name:'숲속 초록', primary:'#7aaa7a', bg:'#f2f8f2', accent:'#4a7a4a' },
  { name:'장미 핑크', primary:'#c47a8a', bg:'#fdf2f4', accent:'#8c4a5a' },
  { name:'라벤더', primary:'#9b89c4', bg:'#f5f2fb', accent:'#6a4a9c' },
  { name:'먹물 흑백', primary:'#666666', bg:'#f8f8f8', accent:'#333333' },
]
function hexToRgb(hex) {
  if (!hex||hex.length<7) return [200,169,110]
  try { return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)] }
  catch { return [200,169,110] }
}
const WIDGET_OPTIONS = [
  {key:'rulebooks', label:'보유 룰북', icon:'menu_book'},
  {key:'scenarios', label:'보유 시나리오', icon:'description'},
  {key:'wish_scenarios', label:'위시 시나리오', icon:'favorite'},
  {key:'dotori', label:'도토리', icon:'forest'},
  {key:'availability', label:'공수표', icon:'event_available'},
  {key:'logs', label:'다녀온 기록', icon:'auto_stories'},
  {key:'pairs', label:'페어/팀 목록', icon:'people'},
  {key:'characters', label:'PC 목록', icon:'person'},
  {key:'bookmarks', label:'북마크', icon:'bookmark'},
  {key:'guestbook', label:'방명록', icon:'mail'},
]

const DEFAULT_SECTIONS = [
  {id:'play_style', label:'플레이 스타일', value:''},
  {id:'caution', label:'주의 사항', value:''},
  {id:'extra_info', label:'기타 사항', value:''},
]

const DONATION_TIER_LABEL = { master:'마스터', '3ht':'♥♥♥', '2ht':'♥♥', '1ht':'♥' }
const DONATION_TIER_COLOR = { master:'#7c5cbf', '3ht':'#d4a017', '2ht':'#9e9e9e', '1ht':'#b87333' }

const fmtDateShort = (iso) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })
}
const daysUntilExpiry = (iso) => {
  if (!iso) return null
  return Math.ceil((new Date(iso) - new Date()) / 86400000)
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const location = useLocation()
  const [tab, setTab] = useState(location.state?.tab || 'profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newLink, setNewLink] = useState({label:'',url:''})
  const [pwForm, setPwForm] = useState({next:'', confirm:''})
  const [pwMsg, setPwMsg] = useState(null)
  const [pwErr, setPwErr] = useState(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)
  const [withdrawInput, setWithdrawInput] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const dragIdx = useRef(null)

  // ── form을 profile에서 초기화 (profile이 바뀔 때마다 동기화) ──
  const buildForm = (p) => ({
    display_name: p?.display_name||'',
    avatar_url: p?.avatar_url||'',
    profile_sections: p?.profile_sections?.length>0 ? p.profile_sections
      : DEFAULT_SECTIONS.map(s=>({...s, value:p?.[s.id]||''})),
    external_links: p?.external_links||[],
    header_image_url: p?.header_image_url||'',
    theme_color: p?.theme_color||'#c8a96e',
    theme_bg_color: p?.theme_bg_color||'#faf6f0',
    theme_accent: p?.theme_accent||'#8b6f47',
    background_image_url: p?.background_image_url||'',
    bg_opacity: p?.bg_opacity!==undefined ? p.bg_opacity : 1,
    is_public: p?.is_public??true,
    hidden_tabs: p?.hidden_tabs||[],
    scenario_sort_order: p?.scenario_sort_order||'asc',
    bookmark_sort_order: p?.bookmark_sort_order||'asc',
    availability_sort_order: p?.availability_sort_order||'asc',
    dashboard_cards: p?.dashboard_cards || ['logs','rulebooks','scenarios','pairs'],
    theme_text_color: p?.theme_text_color || '',
    dark_mode: p?.dark_mode || false,
    cursor_effect: {
      enabled_public: true,
      cursor: { type: 'default' },
      trail:  { enabled: false, type: 'sparkle' },
      click:  { enabled: false, type: 'ripple'  },
      ...(p?.cursor_effect || {}),
    },
  })

  const [form, setForm] = useState(() => buildForm(profile))
  const [isDirty, setIsDirty] = useState(false)
  const savedFormRef = useRef(buildForm(profile))
  const profileRef = useRef(profile)

  // profile이 외부에서 바뀌면 form도 업데이트 (단, 현재 편집 중이면 덮어쓰지 않음)
  const isMounted = useRef(false)
  useEffect(() => {
    profileRef.current = profile
    if (!isMounted.current) { isMounted.current = true; return }
    if (!saving) { const f = buildForm(profile); setForm(f); savedFormRef.current = f }
  }, [profile?.updated_at])

  // form 변경 감지 → isDirty
  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(savedFormRef.current))
  }, [form])

  // 브라우저 새로고침/탭 닫기 경고
  useEffect(() => {
    const handler = e => { if (isDirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // 언마운트 시 원래 테마로 복원
  useEffect(() => {
    return () => {
      const p = profileRef.current
      if (!p) return
      applyTheme(p.theme_color||'#c8a96e', p.theme_bg_color||'#faf6f0', p.theme_accent||'#8b6f47', p.theme_text_color||null, p.dark_mode||false)
      applyBackground(p.background_image_url||'', p.bg_opacity??1, p.dark_mode||false, p.theme_color||'#c8a96e')
    }
  }, [])


  const set = k => e => setForm(f=>({...f, [k]:e.target.value}))
  const updateSection = (idx,field,value) => setForm(f=>{const s=[...f.profile_sections];s[idx]={...s[idx],[field]:value};return {...f,profile_sections:s}})
  const addSection = () => setForm(f=>({...f, profile_sections:[...f.profile_sections,{id:`custom_${Date.now()}`,label:'새 항목',value:''}]}))
  const removeSection = idx => setForm(f=>({...f, profile_sections:f.profile_sections.filter((_,i)=>i!==idx)}))

  // 드래그 순서 변경
  const onDragStart = (idx) => { dragIdx.current = idx }
  const onDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx.current === idx) return
    setForm(f => {
      const s = [...f.profile_sections]
      const [dragged] = s.splice(dragIdx.current, 1)
      s.splice(idx, 0, dragged)
      dragIdx.current = idx
      return {...f, profile_sections: s}
    })
  }

  const applyPreset = p => { setForm(f=>({...f,theme_color:p.primary,theme_bg_color:p.bg,theme_accent:p.accent})); applyTheme(p.primary,p.bg,p.accent,form.theme_text_color||null,form.dark_mode) }
  const handleColorChange = (key,value) => { const u={...form,[key]:value}; setForm(u); applyTheme(u.theme_color,u.theme_bg_color,u.theme_accent,u.theme_text_color||null,u.dark_mode) }
  const handleOpacityChange = value => { const o=parseFloat(value); setForm(f=>({...f,bg_opacity:o})); applyBackground(form.background_image_url,o,form.dark_mode,form.theme_color) }
  const handleBgUrlChange = value => { setForm(f=>({...f,background_image_url:value})); applyBackground(value,form.bg_opacity,form.dark_mode,form.theme_color) }
  const handleTextColorChange = value => { const u={...form,theme_text_color:value}; setForm(u); applyTheme(u.theme_color,u.theme_bg_color,u.theme_accent,value||null,u.dark_mode) }
  const handleDarkModeToggle = value => { const u={...form,dark_mode:value}; setForm(u); applyTheme(u.theme_color,u.theme_bg_color,u.theme_accent,u.theme_text_color||null,value); applyBackground(u.background_image_url,u.bg_opacity,value,u.theme_color) }

  const save = async () => {
    setSaving(true)
    // 커서 효과 최초 ON 시 혜택 최초 사용일 기록
    const ce = form.cursor_effect
    if (ce && (ce.trail?.enabled || ce.click?.enabled)) {
      await recordFirstMembershipUse(profile, user.id)
    }
    const {error} = await updateProfile(user.id, form)
    if (!error) {
      await refreshProfile()
      savedFormRef.current = form
      setIsDirty(false)
      setSaved(true); setTimeout(()=>setSaved(false),2500)
      applyTheme(form.theme_color,form.theme_bg_color,form.theme_accent,form.theme_text_color||null,form.dark_mode)
      applyBackground(form.background_image_url,form.bg_opacity,form.dark_mode,form.theme_color)
    }
    setSaving(false)
  }



  const addLink = () => { if(!newLink.label||!newLink.url) return; setForm(f=>({...f,external_links:[...(f.external_links||[]),{...newLink}]})); setNewLink({label:'',url:''}) }
  const removeLink = idx => setForm(f=>({...f,external_links:f.external_links.filter((_,i)=>i!==idx)}))

  // 비밀번호 변경
  const handlePwChange = async e => {
    e.preventDefault(); setPwErr(null); setPwMsg(null)
    if (pwForm.next !== pwForm.confirm) { setPwErr('새 비밀번호가 일치하지 않아요.'); return }
    if (pwForm.next.length < 6) { setPwErr('비밀번호는 6자 이상이어야 해요.'); return }
    setPwLoading(true)
    const {error} = await supabase.auth.updateUser({password: pwForm.next})
    setPwLoading(false)
    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('same password') || msg.includes('different from the old')) setPwErr('현재 비밀번호와 동일해요. 다른 비밀번호를 입력해주세요.')
      else if (msg.includes('at least')) setPwErr('비밀번호는 6자 이상이어야 해요.')
      else if (msg.includes('session') || msg.includes('not authenticated')) setPwErr('인증이 만료됐어요. 다시 로그인 후 시도해주세요.')
      else setPwErr('비밀번호 변경 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
    } else {
      setPwMsg('비밀번호가 변경됐어요! ✅')
      setPwForm({next:'', confirm:''})
    }
  }

  const isLv2Plus   = ['1ht','2ht','3ht','master'].includes(profile?.membership_tier)
  const isSupporter = ['1ht','2ht','3ht','master'].includes(profile?.membership_tier)
  // cursor_effect 중첩 업데이트 헬퍼
  const setCE = (key, val) => setForm(f => ({ ...f, cursor_effect: { ...f.cursor_effect, [key]: val } }))
  const setCECursor = (key, val) => setForm(f => ({ ...f, cursor_effect: { ...f.cursor_effect, cursor: { ...f.cursor_effect.cursor, [key]: val } } }))
  const setCETrail  = (key, val) => setForm(f => ({ ...f, cursor_effect: { ...f.cursor_effect, trail:  { ...f.cursor_effect.trail,  [key]: val } } }))
  const setCEClick  = (key, val) => setForm(f => ({ ...f, cursor_effect: { ...f.cursor_effect, click:  { ...f.cursor_effect.click,  [key]: val } } }))

  const TABS = [
    {key:'profile',  label:'프로필',    icon:'person'},
    {key:'theme',    label:'테마',      icon:'palette'},
    {key:'dashboard',label:'홈화면',    icon:'dashboard'},
    {key:'privacy',  label:'공개 설정', icon:'lock'},
    ...(isSupporter ? [{key:'donation',  label:'후원 정보',  icon:'favorite'}] : []),
    ...(isLv2Plus   ? [{key:'supporter', label:'커서 효과', icon:'auto_awesome'}] : []),
    {key:'security', label:'보안 설정', icon:'security'},
  ]

  const handleWithdraw = async () => {
    if (withdrawInput !== '탈퇴합니다') return
    setWithdrawing(true)
    try {
      // 1. withdrawn_emails에 이메일 저장 (24시간 재가입 제한용) - UPSERT
      const email = user.email?.toLowerCase()
      await supabase.from('withdrawn_emails').upsert(
        { email, withdrawn_at: new Date().toISOString() },
        { onConflict: 'email' }
      )
      // 2. 모든 사용자 데이터 + auth.users 삭제 (SQL 함수)
      const { error } = await supabase.rpc('delete_user')
      if (error) throw error
      await supabase.auth.signOut()
      alert('탈퇴가 완료됐어요. 이용해주셔서 감사합니다.')
      window.location.href = '/login'
    } catch(e) {
      alert('탈퇴 처리 중 오류가 발생했어요: ' + e.message)
    }
    setWithdrawing(false)
  }

  return (
    <div className="fade-in">
      {isDirty && (
        <div style={{position:'sticky',top:0,zIndex:100,background:'var(--color-primary)',color:'white',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderRadius:8,marginBottom:12,fontSize:'0.85rem',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><Mi size='sm' color='white'>edit_note</Mi>저장하지 않은 변경사항이 있어요.</span>
          <button className="btn btn-sm" style={{background:'white',color:'var(--color-primary)',fontWeight:700,padding:'3px 12px'}} onClick={save}>{saving?'저장 중…':'지금 저장'}</button>
        </div>
      )}
      <div className="page-header"><h1 className="page-title"><Mi style={{marginRight:8,verticalAlign:"middle"}}>settings</Mi>환경설정</h1><p className="page-subtitle">나만의 TRPG 다이어리를 꾸며보세요</p></div>
      <div className="flex gap-8" style={{marginBottom:24,flexWrap:'wrap'}}>
        {TABS.map(t=><button key={t.key} className={`btn ${tab===t.key?'btn-primary':'btn-outline'}`} onClick={()=>setTab(t.key)} style={{display:'flex',alignItems:'center',gap:4}}><Mi size='sm' color={tab===t.key?'white':'accent'}>{t.icon}</Mi>{t.label}</button>)}
      </div>

      <div className="card card-lg" style={{maxWidth:620}}>

        {/* ── 프로필 ── */}
        {tab==='profile'&&(
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}>프로필 설정</h2>
            {/* 헤더 이미지 */}
            <div className="form-group">
              <label className="form-label">공개 페이지 헤더 이미지 <span style={{fontWeight:400,color:'var(--color-text-light)',fontSize:'0.78rem'}}>(권장: 1200×400px, 상단 기준 크롭)</span></label>
              {form.header_image_url&&<div style={{borderRadius:8,overflow:'hidden',marginBottom:8,height:90,background:'var(--color-nav-active-bg)'}}><img src={form.header_image_url} alt="header" style={{width:'100%',height:'100%',objectFit:'cover'}} /></div>}
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.header_image_url||''} onChange={set('header_image_url')} style={{flex:1}} />
                {form.header_image_url&&<button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,header_image_url:''}))}>제거</button>}
              </div>
            </div>
            {/* 아바타 */}
            <div className="form-group">
              <label className="form-label">프로필 이미지 <span style={{fontWeight:400,color:'var(--color-text-light)',fontSize:'0.78rem'}}>(권장: 정사각형, 200×200px 이상)</span></label>
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
                <div className="user-avatar" style={{width:56,height:56,fontSize:'1.3rem',flexShrink:0}}>
                  {(form.avatar_url||profile?.avatar_url)
                    ? <img src={form.avatar_url||profile?.avatar_url} alt="avatar"/>
                    : (profile?.display_name||'?')[0]}
                </div>
                {(form.avatar_url||profile?.avatar_url) && (
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}}
                    onClick={async()=>{
                      await updateProfile(user.id,{avatar_url:null})
                      setForm(f=>({...f,avatar_url:''}))
                      refreshProfile()
                    }}>제거</button>
                )}
              </div>
              <input className="form-input" placeholder="이미지 URL 입력 (https://...)"
                value={form.avatar_url||''} onChange={e=>setForm(f=>({...f,avatar_url:e.target.value}))}/>
            </div>
            <div className="form-group"><label className="form-label">사용자명 (URL)</label><div style={{display:'flex',alignItems:'center',gap:6}}><span className="text-light text-sm">https://trpg-diary.co.kr/u/</span><input className="form-input" value={profile?.username||''} disabled style={{flex:1,opacity:0.6}} /></div></div>
            <div className="form-group"><label className="form-label">표시 이름</label><input className="form-input" value={form.display_name} onChange={set('display_name')} /></div>

            {/* 커스텀 프로필 항목 (드래그 순서 변경) */}
            <div style={{marginBottom:8}}>
              <div className="flex justify-between items-center" style={{marginBottom:12}}>
                <label className="form-label" style={{marginBottom:0}}>프로필 소개 항목</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={addSection}>+ 항목 추가</button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {form.profile_sections.map((section,idx)=>(
                  <div key={section.id}
                    draggable
                    onDragStart={()=>onDragStart(idx)}
                    onDragOver={e=>onDragOver(e,idx)}
                    style={{border:'1px solid var(--color-border)',borderRadius:8,padding:12,background:'var(--color-nav-active-bg)',cursor:'grab'}}
                  >
                    <div className="flex justify-between items-center" style={{marginBottom:8}}>
                      <div className="flex items-center gap-8" style={{flex:1,marginRight:8}}>
                        <span style={{color:'var(--color-text-light)',fontSize:'0.9rem',cursor:'grab'}}>⠿</span>
                        <input className="form-input" value={section.label} onChange={e=>updateSection(idx,'label',e.target.value)} style={{fontWeight:600,fontSize:'0.82rem',flex:1}} placeholder="항목 이름" />
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" style={{color:'#e57373',flexShrink:0}} onClick={()=>removeSection(idx)}>삭제</button>
                    </div>
                    <textarea className="form-textarea" value={section.value||''} onChange={e=>updateSection(idx,'value',e.target.value)} placeholder={`${section.label} 내용 입력...`} style={{minHeight:72,whiteSpace:'pre-wrap'}} />
                  </div>
                ))}
              </div>
            </div>

            {/* 외부 링크 */}
            <div className="form-group" style={{marginTop:16}}>
              <label className="form-label">외부 링크 (성향표, 구글 시트 등)</label>
              {(form.external_links||[]).map((link,idx)=>(
                <div key={idx} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                  <span style={{flex:1,fontSize:'0.82rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link.label} — <span style={{color:'var(--color-primary)'}}>{link.url}</span></span>
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373',flexShrink:0}} onClick={()=>removeLink(idx)}>삭제</button>
                </div>
              ))}
              <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                <input className="form-input" placeholder="링크 이름" value={newLink.label} onChange={e=>setNewLink(l=>({...l,label:e.target.value}))} style={{flex:'0 0 130px'}} />
                <input className="form-input" placeholder="https://..." value={newLink.url} onChange={e=>setNewLink(l=>({...l,url:e.target.value}))} style={{flex:1,minWidth:150}} />
                <button className="btn btn-outline btn-sm" onClick={addLink}>추가</button>
              </div>
            </div>
          </>
        )}

        {/* ── 홈화면 위젯 ── */}
        {tab==='dashboard'&&(
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:8,fontSize:'1rem'}}>홈화면 위젯 선택</h2>
            <p className="text-sm text-light" style={{marginBottom:20}}>홈화면 상단에 표시할 위젯 4개를 선택하세요.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {WIDGET_OPTIONS.map(w=>{
                const validKeys = WIDGET_OPTIONS.map(o=>o.key)
                const validCards = (form.dashboard_cards||[]).filter(k=>validKeys.includes(k))
                const isSelected=validCards.includes(w.key)
                const canAdd=validCards.length<4
                return (
                  <div key={w.key} className="card" style={{padding:'10px 14px',background:'var(--color-nav-active-bg)',opacity:(!isSelected&&!canAdd)?0.45:1,transition:'opacity 0.15s'}}>
                    <div className="flex justify-between items-center">
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <Mi size='sm' color={isSelected?'accent':'light'}>{w.icon}</Mi>
                        <span style={{fontSize:'0.88rem',fontWeight:500,color:isSelected?'var(--color-text)':'var(--color-text-light)'}}>{w.label}</span>
                      </div>
                      <div
                        onClick={()=>{
                          if(isSelected) setForm(f=>({...f,dashboard_cards:(f.dashboard_cards||[]).filter(k=>k!==w.key)}))
                          else if(canAdd) setForm(f=>({...f,dashboard_cards:[...(f.dashboard_cards||[]),w.key]}))
                        }}
                        style={{width:36,height:20,borderRadius:10,background:isSelected?'var(--color-primary)':'#ccc',position:'relative',cursor:(!isSelected&&!canAdd)?'not-allowed':'pointer',transition:'background 0.2s',flexShrink:0}}>
                        <div style={{position:'absolute',top:2,left:isSelected?18:2,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-light" style={{marginTop:12,textAlign:'right'}}>{(form.dashboard_cards||[]).filter(k=>WIDGET_OPTIONS.some(w=>w.key===k)).length}/4 선택됨</p>
          </>
        )}

        {/* ── 테마 ── */}
        {tab==='theme'&&(
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}>테마 & 디자인</h2>
            <div className="form-group">
              <label className="form-label">프리셋 테마</label>
              <div className="grid-3" style={{gap:8}}>
                {PRESET_COLORS.map(p=>(
                  <button key={p.name} onClick={()=>applyPreset(p)} style={{padding:'10px 6px',borderRadius:8,cursor:'pointer',border:`2px solid ${form.theme_color===p.primary?'var(--color-text)':'transparent'}`,background:p.bg,textAlign:'center',transition:'all 0.2s'}}>
                    <div style={{display:'flex',justifyContent:'center',gap:3,marginBottom:5}}>{[p.primary,p.accent,p.bg].map((c,i)=><div key={i} style={{width:13,height:13,borderRadius:'50%',background:c,border:'1px solid rgba(0,0,0,0.1)'}} />)}</div>
                    <div style={{fontSize:'0.68rem',color:p.accent,fontWeight:600}}>{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-3" style={{marginBottom:16}}>
              {[{label:'메인 컬러',key:'theme_color'},{label:'배경 컬러',key:'theme_bg_color'},{label:'강조 컬러',key:'theme_accent'}].map(({label,key})=>(
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="color" value={form[key]} onChange={e=>handleColorChange(key,e.target.value)} style={{width:36,height:32,border:'none',cursor:'pointer',borderRadius:5,padding:2}} />
                    <input className="form-input" value={form[key]} onChange={e=>handleColorChange(key,e.target.value)} style={{flex:1,fontFamily:'monospace',fontSize:'0.75rem'}} />
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">배경 이미지 <span style={{fontWeight:400,color:'var(--color-text-light)',fontSize:'0.78rem'}}>(권장: 1920×1080px)</span></label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.background_image_url} onChange={e=>handleBgUrlChange(e.target.value)} style={{flex:1}} />
              </div>
              {form.background_image_url&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}><img src={form.background_image_url} alt="bg" style={{width:72,height:44,objectFit:'cover',borderRadius:5,border:'1px solid var(--color-border)'}} /><button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>{setForm(f=>({...f,background_image_url:''}));applyBackground('',1,form.dark_mode,form.theme_color)}}>제거</button></div>}
            </div>
            {form.background_image_url&&(
              <div className="form-group">
                <label className="form-label">배경 이미지 불투명도 <span style={{color:'var(--color-accent)',fontWeight:700}}>{Math.round(form.bg_opacity*100)}%</span></label>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className="text-xs text-light">흐리게</span>
                  <input type="range" min="0.1" max="1" step="0.05" value={form.bg_opacity} onChange={e=>handleOpacityChange(e.target.value)} style={{flex:1,height:4,cursor:'pointer',accentColor:'var(--color-primary)'}} />
                  <span className="text-xs text-light">선명하게</span>
                </div>
              </div>
            )}
            {/* 폰트 색상 */}
            <div className="form-group">
              <label className="form-label">폰트 색상 <span className="text-xs text-light" style={{fontWeight:400}}>(비어 있으면 강조 컬러 기반 자동)</span></label>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="color" value={form.theme_text_color||'#5a4a3a'} onChange={e=>handleTextColorChange(e.target.value)} style={{width:36,height:32,border:'none',cursor:'pointer',borderRadius:5,padding:2}} />
                <input className="form-input" value={form.theme_text_color||''} onChange={e=>handleTextColorChange(e.target.value)} style={{flex:1,fontFamily:'monospace',fontSize:'0.75rem'}} placeholder="자동" />
                {form.theme_text_color&&<button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={()=>handleTextColorChange('')}>초기화</button>}
              </div>
            </div>

            {/* 다크 모드 */}
            <div className="card" style={{marginBottom:16,background:'var(--color-nav-active-bg)'}}>
              <div className="flex justify-between items-center">
                <div>
                  <div style={{fontWeight:600,marginBottom:3,fontSize:'0.9rem'}}>다크 모드</div>
                  <div className="text-sm text-light">배경을 어둡게 전환해요. 메인/강조 컬러는 유지돼요.</div>
                </div>
                <div onClick={()=>handleDarkModeToggle(!form.dark_mode)} style={{width:40,height:22,borderRadius:11,background:form.dark_mode?'var(--color-primary)':'#ccc',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:form.dark_mode?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
                </div>
              </div>
            </div>

            <div style={{padding:14,borderRadius:8,background:form.theme_bg_color,border:`2px solid ${form.theme_color}30`}}>
              <div style={{color:form.theme_accent,fontSize:'0.85rem',fontWeight:700,marginBottom:6}}>✦ 미리보기</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <div style={{padding:'5px 12px',borderRadius:6,background:form.theme_color,color:'white',fontSize:'0.76rem',boxShadow:`0 1px 8px ${form.theme_color}55`}}>버튼</div>
                <div style={{padding:'5px 12px',borderRadius:6,background:`rgba(${hexToRgb(form.theme_color).join(',')},0.12)`,color:form.theme_accent,fontSize:'0.76rem'}}>활성 메뉴</div>
              </div>
            </div>
          </>
        )}

        {/* ── 공개 설정 ── */}
        {tab==='privacy'&&(
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}>공개 설정</h2>
            <div className="card" style={{marginBottom:14,background:'var(--color-nav-active-bg)'}}>
              <div className="flex justify-between items-center">
                <div>
                  <div style={{fontWeight:600,marginBottom:3,fontSize:'0.9rem'}}>공개 페이지 활성화</div>
                  <div className="text-sm text-light">다른 사람이 내 페이지를 볼 수 있어요</div>
                  {profile?.username&&<div className="text-xs" style={{marginTop:5,color:'var(--color-accent)'}}><Mi size="sm">link</Mi> https://trpg-diary.co.kr/u/{profile.username}</div>}
                </div>
                <div onClick={()=>setForm(f=>({...f,is_public:!f.is_public}))} style={{width:40,height:22,borderRadius:11,background:form.is_public?'var(--color-primary)':'#ccc',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:form.is_public?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}} />
                </div>
              </div>
            </div>
            {form.is_public&&<div style={{padding:14,borderRadius:8,background:'rgba(104,159,56,0.08)',border:'1px solid rgba(104,159,56,0.2)',marginBottom:20}}><div className="text-sm" style={{color:'#558b2f'}}>✅ 공개 상태예요.<br/><br/><strong>https://trpg-diary.co.kr/u/{profile?.username}</strong></div><button className="btn btn-outline btn-sm" style={{marginTop:10}} onClick={()=>{navigator.clipboard.writeText(`https://trpg-diary.co.kr/u/${profile?.username}`);alert('복사됐어요!')}}>링크 복사</button></div>}

            {/* 탭별 공개 설정 */}
            <h3 style={{fontWeight:700,fontSize:'0.9rem',marginBottom:12,color:'var(--color-text)'}}>탭별 공개 설정</h3>
            <p className="text-sm text-light" style={{marginBottom:14}}>공개 페이지에서 숨기고 싶은 탭을 선택하세요. 본인은 항상 볼 수 있어요.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {key:'schedules', label:'일정 관리', icon:'calendar_month'},
                {key:'rulebooks', label:'보유 룰북', icon:'menu_book'},
                {key:'scenarios', label:'보유 시나리오', icon:'description'},
                {key:'wish_scenarios', label:'위시 시나리오', icon:'favorite'},
                {key:'dotori', label:'도토리', icon:'forest'},
                {key:'availability', label:'공수표', icon:'event_available'},
                {key:'logs', label:'다녀온 기록', icon:'auto_stories'},
                {key:'pairs', label:'페어/팀', icon:'people'},
                {key:'characters', label:'PC 목록', icon:'person'},
                {key:'bookmarks', label:'북마크', icon:'bookmark'},
                {key:'guestbook', label:'방명록', icon:'mail'},
              ].map(t => {
                const isHidden = (form.hidden_tabs||[]).includes(t.key)
                return (
                  <div key={t.key} className="card" style={{padding:'10px 14px',background:'var(--color-nav-active-bg)'}}>
                    <div className="flex justify-between items-center">
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <Mi size='sm' color={isHidden?'light':'accent'}>{t.icon}</Mi>
                        <span style={{fontSize:'0.88rem',fontWeight:500,color:isHidden?'var(--color-text-light)':'var(--color-text)'}}>{t.label}</span>
                        {isHidden&&<span className="badge badge-gray" style={{fontSize:'0.65rem'}}>비공개</span>}
                      </div>
                      <div onClick={()=>setForm(f=>({...f,hidden_tabs:isHidden?(f.hidden_tabs||[]).filter(k=>k!==t.key):[...(f.hidden_tabs||[]),t.key]}))}
                        style={{width:36,height:20,borderRadius:10,background:isHidden?'#ccc':'var(--color-primary)',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                        <div style={{position:'absolute',top:2,left:isHidden?2:18,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── 보안 설정 (비밀번호 변경 + 회원 탈퇴) ── */}
        {tab==='security'&&(
          <div>
            {/* 비밀번호 변경 */}
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem',display:'flex',alignItems:'center',gap:6}}>
              <Mi size='sm' color='accent'>lock_reset</Mi> 비밀번호 변경
            </h2>
            {pwErr&&<div style={{padding:'10px 14px',borderRadius:8,background:'rgba(229,115,115,0.1)',border:'1px solid rgba(229,115,115,0.3)',color:'#c62828',fontSize:'0.82rem',marginBottom:14}}>{pwErr}</div>}
            {pwMsg&&<div style={{padding:'10px 14px',borderRadius:8,background:'rgba(104,159,56,0.1)',border:'1px solid rgba(104,159,56,0.3)',color:'#33691e',fontSize:'0.82rem',marginBottom:14}}>{pwMsg}</div>}
            <form onSubmit={handlePwChange} style={{marginBottom:36}}>
              <div className="form-group"><label className="form-label">새 비밀번호</label><input className="form-input" type="password" placeholder="6자 이상" value={pwForm.next} onChange={e=>setPwForm(f=>({...f,next:e.target.value}))} disabled={pwLoading} required /></div>
              <div className="form-group"><label className="form-label">새 비밀번호 확인</label><input className="form-input" type="password" placeholder="동일하게 입력" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} disabled={pwLoading} required /></div>
              <button className="btn btn-primary btn-sm" type="submit" disabled={pwLoading}><Mi size='sm' color='white'>lock_reset</Mi> {pwLoading ? '변경 중...' : '비밀번호 변경'}</button>
            </form>

            {/* 구분선 */}
            <hr style={{border:'none',borderTop:'1px solid var(--color-border)',marginBottom:28}}/>

            {/* 회원 탈퇴 */}
            <h2 style={{fontWeight:700,color:'#e57373',marginBottom:8,fontSize:'1rem',display:'flex',alignItems:'center',gap:6}}>
              <Mi size='sm' color='danger'>person_remove</Mi> 회원 탈퇴
            </h2>
            <div style={{padding:'14px 16px',borderRadius:10,background:'rgba(229,115,115,0.07)',border:'1px solid rgba(229,115,115,0.25)',marginBottom:20,fontSize:'0.84rem',color:'var(--color-text-light)',lineHeight:1.8}}>
              탈퇴 시 모든 데이터(일정, 기록, 룰북, 페어 등)가 <strong>영구적으로 삭제</strong>되며 복구할 수 없어요.<br/>
              신중하게 결정해주세요.
            </div>
            {!withdrawConfirm ? (
              <button className="btn btn-sm" style={{background:'rgba(229,115,115,0.1)',color:'#e57373',border:'1px solid rgba(229,115,115,0.3)'}}
                onClick={() => setWithdrawConfirm(true)}>
                <Mi size='sm' color='danger'>person_remove</Mi> 탈퇴 진행하기
              </button>
            ) : (
              <div>
                <p style={{fontSize:'0.84rem',marginBottom:10,color:'var(--color-text-light)'}}>
                  정말 탈퇴하시겠어요? 아래 칸에 <strong style={{color:'#e57373'}}>탈퇴합니다</strong> 를 입력해주세요.
                </p>
                <input className="form-input" placeholder="탈퇴합니다" value={withdrawInput}
                  onChange={e => setWithdrawInput(e.target.value)}
                  style={{marginBottom:10,borderColor:withdrawInput==='탈퇴합니다'?'#e57373':undefined}}/>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-outline btn-sm" onClick={() => {setWithdrawConfirm(false);setWithdrawInput('')}}>
                    취소
                  </button>
                  <button className="btn btn-sm" style={{background:'#e57373',color:'white',border:'none'}}
                    onClick={handleWithdraw}
                    disabled={withdrawInput !== '탈퇴합니다' || withdrawing}>
                    {withdrawing ? '처리 중...' : '최종 탈퇴'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 후원 정보 탭 ── */}
        {tab==='donation'&&isSupporter&&(()=>{
          const tier    = profile?.membership_tier
          const label   = DONATION_TIER_LABEL[tier] || tier
          const color   = DONATION_TIER_COLOR[tier] || 'var(--color-primary)'
          const expires = profile?.membership_expires_at
          const started = profile?.membership_first_used_at
          const days    = daysUntilExpiry(expires)
          const urgent  = days !== null && days >= 0 && days <= 3
          const expired = days !== null && days < 0
          return (
            <div>
              <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:4,fontSize:'1rem',display:'flex',alignItems:'center',gap:6}}>
                <Mi size='sm' color='accent'>favorite</Mi> 후원 정보
              </h2>
              <p style={{fontSize:'0.78rem',color:'var(--color-text-light)',marginBottom:20}}>
                현재 후원 등급 및 멤버십 이용 기간을 확인할 수 있어요.
              </p>

              {/* 등급 + 이용 기간 */}
              <div className="card" style={{padding:'16px 18px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <span style={{padding:'3px 12px',borderRadius:100,fontSize:'0.8rem',fontWeight:700,background:color,color:'#fff'}}>
                    {label}
                  </span>
                  <span style={{fontWeight:600,fontSize:'0.9rem'}}>후원 멤버십</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px',fontSize:'0.83rem'}}>
                  <div>
                    <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',marginBottom:3}}>혜택 시작일</div>
                    <div style={{fontWeight:500}}>{fmtDateShort(started)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',marginBottom:3}}>만료일</div>
                    <div style={{display:'flex',alignItems:'center',gap:6,fontWeight:500}}>
                      {fmtDateShort(expires)}
                      {urgent && (
                        <span style={{padding:'1px 7px',borderRadius:100,fontSize:'0.68rem',fontWeight:700,background:'rgba(229,115,115,0.15)',color:'#e57373'}}>
                          만료 {days}일 전
                        </span>
                      )}
                      {expired && (
                        <span style={{padding:'1px 7px',borderRadius:100,fontSize:'0.68rem',fontWeight:700,background:'rgba(229,115,115,0.15)',color:'#e57373'}}>
                          만료됨
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 포스타입 링크 */}
              <div className="card" style={{padding:'14px 16px',marginBottom:20}}>
                <a href="https://posty.pe/6v8jm2" target="_blank" rel="noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:8,padding:'9px 18px',borderRadius:8,
                    background:'var(--color-primary)',color:'#fff',textDecoration:'none',fontWeight:600,fontSize:'0.85rem'}}>
                  <Mi size='sm' color='white'>open_in_new</Mi>포스타입 멤버십 페이지
                </a>
              </div>

              {/* 후원 안내 텍스트 */}
              <div style={{padding:'16px 18px',borderRadius:10,background:'var(--color-nav-active-bg)',border:'1px solid var(--color-border)',fontSize:'0.82rem',lineHeight:1.9,color:'var(--color-text-light)'}}>
                {expires && !expired && (
                  <p style={{marginBottom:12,color:'var(--color-text)',fontWeight:500}}>
                    현재 월 정기 후원 만료 <strong style={{color: urgent?'#e57373':'var(--color-accent)'}}>{days}일 전</strong>입니다.
                  </p>
                )}
                <p style={{marginBottom:12}}>
                  포스타입 멤버십을 유지 중이신 경우, 관리자 확인을 거쳐 이용 기간이 영업일 기준 순차적으로 자동 연장됩니다.<br/>
                  후원 중단을 원하실 경우, <a href="https://posty.pe/6v8jm2" target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',textDecoration:'underline'}}>포스타입 멤버십 설정</a>에서 구독을 취소해 주세요.
                </p>
                <div style={{borderTop:'1px solid var(--color-border)',paddingTop:12,marginTop:4}}>
                  <div style={{fontWeight:600,marginBottom:6,color:'var(--color-text)',fontSize:'0.8rem'}}>⚠️ 주의사항</div>
                  <ul style={{margin:0,paddingLeft:16,display:'flex',flexDirection:'column',gap:4}}>
                    <li><strong style={{color:'var(--color-text)'}}>혜택 종료:</strong> 후원 만료 시 제공되던 모든 후원자 전용 기능의 이용이 제한됩니다.</li>
                    <li><strong style={{color:'var(--color-text)'}}>데이터 보관:</strong> 등록하신 후원자 전용 데이터는 안전하게 보관되며, 재후원 시 별도의 복구 과정 없이 즉시 이전 상태로 연결됩니다.</li>
                    <li>자세한 내용은 <a href="https://posty.pe/6v8jm2" target="_blank" rel="noreferrer" style={{color:'var(--color-primary)',textDecoration:'underline'}}>포스타입 후원 및 멤버십 안내글</a> 또는 <a href="/privacy" style={{color:'var(--color-primary)',textDecoration:'underline'}}>개인정보처리방침</a>을 확인해주세요.</li>
                  </ul>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── 후원자 전용: 커서 효과 ── */}
        {tab==='supporter'&&isLv2Plus&&(
          <div>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:4,fontSize:'1rem',display:'flex',alignItems:'center',gap:6}}>
              <Mi size='sm' color='accent'>auto_awesome</Mi> 커서 효과
            </h2>
            <p style={{fontSize:'0.78rem',color:'var(--color-text-light)',marginBottom:20}}>
              마우스 커서와 움직임에 특별한 효과를 추가해요. 데스크톱 전용이에요.
            </p>

            {/* 공개 페이지 표시 여부 */}
            <div className="card" style={{padding:'14px 16px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{fontWeight:600,fontSize:'0.85rem'}}>공개 페이지에 효과 표시</div>
                <div style={{fontSize:'0.75rem',color:'var(--color-text-light)',marginTop:2}}>OFF 시 나에게만 보여요</div>
              </div>
              <div onClick={()=>setCE('enabled_public',!form.cursor_effect.enabled_public)}
                style={{width:40,height:22,borderRadius:11,background:form.cursor_effect.enabled_public?'var(--color-primary)':'#ccc',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                <div style={{position:'absolute',top:3,left:form.cursor_effect.enabled_public?20:3,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
              </div>
            </div>

            {/* 커서 모양 */}
            <div className="card" style={{padding:'14px 16px',marginBottom:12}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',marginBottom:12}}>커서 모양</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
                {[
                  {type:'default', label:'기본', emoji:'🖱️'},
                  {type:'dice',    label:'🎲 주사위'},
                  {type:'wand',    label:'🪄 마법봉'},
                  {type:'pen',     label:'✒️ 펜'},
                  {type:'custom',  label:'✨ 직접 입력'},
                ].map(({type, label}) => (
                  <button key={type}
                    onClick={()=>setCECursor('type', type)}
                    className={`btn btn-sm ${form.cursor_effect.cursor.type===type?'btn-primary':'btn-outline'}`}
                    style={{fontSize:'0.78rem'}}>
                    {label}
                  </button>
                ))}
              </div>
              {form.cursor_effect.cursor.type==='custom'&&(
                <input className="form-input" placeholder="GIF 또는 PNG 이미지 URL"
                  value={form.cursor_effect.cursor.url||''}
                  onChange={e=>setCECursor('url', e.target.value)}
                  style={{fontSize:'0.8rem'}}/>
              )}
            </div>

            {/* 트레일 효과 */}
            <div className="card" style={{padding:'14px 16px',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:form.cursor_effect.trail.enabled?12:0}}>
                <div style={{fontWeight:600,fontSize:'0.85rem'}}>움직임 트레일</div>
                <div onClick={()=>setCETrail('enabled',!form.cursor_effect.trail.enabled)}
                  style={{width:40,height:22,borderRadius:11,background:form.cursor_effect.trail.enabled?'var(--color-primary)':'#ccc',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:3,left:form.cursor_effect.trail.enabled?20:3,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                </div>
              </div>
              {form.cursor_effect.trail.enabled&&(
                <div style={{display:'flex',gap:8}}>
                  {[{type:'sparkle',label:'✨ 반짝이'},{type:'star',label:'⭐ 별'},{type:'heart',label:'💜 하트'}].map(({type,label})=>(
                    <button key={type} onClick={()=>setCETrail('type',type)}
                      className={`btn btn-sm ${form.cursor_effect.trail.type===type?'btn-primary':'btn-outline'}`}
                      style={{fontSize:'0.78rem'}}>{label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* 클릭 효과 */}
            <div className="card" style={{padding:'14px 16px',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:form.cursor_effect.click.enabled?12:0}}>
                <div style={{fontWeight:600,fontSize:'0.85rem'}}>클릭 효과</div>
                <div onClick={()=>setCEClick('enabled',!form.cursor_effect.click.enabled)}
                  style={{width:40,height:22,borderRadius:11,background:form.cursor_effect.click.enabled?'var(--color-primary)':'#ccc',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:3,left:form.cursor_effect.click.enabled?20:3,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                </div>
              </div>
              {form.cursor_effect.click.enabled&&(
                <div style={{display:'flex',gap:8}}>
                  {[{type:'ripple',label:'🔵 리플'},{type:'particle',label:'💥 파티클'}].map(({type,label})=>(
                    <button key={type} onClick={()=>setCEClick('type',type)}
                      className={`btn btn-sm ${form.cursor_effect.click.type===type?'btn-primary':'btn-outline'}`}
                      style={{fontSize:'0.78rem'}}>{label}</button>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 저장 버튼 (보안 설정/후원 탭 제외) */}
        {tab!=='security' && tab!=='donation' &&(
          <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10}}>
            {saved&&<span className="text-sm" style={{color:'#558b2f'}}>✅ 저장됐어요!</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'설정 저장'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
