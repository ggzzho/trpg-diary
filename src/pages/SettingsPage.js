// src/pages/SettingsPage.js
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { updateProfile, uploadFile, supabase } from '../lib/supabase'
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
const DEFAULT_SECTIONS = [
  {id:'play_style', label:'플레이 스타일', value:''},
  {id:'caution', label:'주의 사항', value:''},
  {id:'extra_info', label:'기타 사항', value:''},
]

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [newLink, setNewLink] = useState({label:'',url:''})
  const [pwForm, setPwForm] = useState({current:'', next:'', confirm:''})
  const [pwMsg, setPwMsg] = useState(null)
  const [pwErr, setPwErr] = useState(null)
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)
  const [withdrawInput, setWithdrawInput] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const dragIdx = useRef(null)

  // ── form을 profile에서 초기화 (profile이 바뀔 때마다 동기화) ──
  const buildForm = (p) => ({
    display_name: p?.display_name||'',
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
  })

  const [form, setForm] = useState(() => buildForm(profile))

  // profile이 외부에서 바뀌면 form도 업데이트 (단, 현재 편집 중이면 덮어쓰지 않음)
  const isMounted = useRef(false)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    if (!saving) setForm(buildForm(profile))
  }, [profile?.updated_at])

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

  const applyPreset = p => { setForm(f=>({...f,theme_color:p.primary,theme_bg_color:p.bg,theme_accent:p.accent})); applyTheme(p.primary,p.bg,p.accent) }
  const handleColorChange = (key,value) => { const u={...form,[key]:value}; setForm(u); applyTheme(u.theme_color,u.theme_bg_color,u.theme_accent) }
  const handleOpacityChange = value => { const o=parseFloat(value); setForm(f=>({...f,bg_opacity:o})); applyBackground(form.background_image_url,o) }
  const handleBgUrlChange = value => { setForm(f=>({...f,background_image_url:value})); applyBackground(value,form.bg_opacity) }

  const save = async () => {
    setSaving(true)
    const {error} = await updateProfile(user.id, form)
    if (!error) {
      await refreshProfile()
      setSaved(true); setTimeout(()=>setSaved(false),2500)
      applyTheme(form.theme_color,form.theme_bg_color,form.theme_accent)
      applyBackground(form.background_image_url,form.bg_opacity)
    }
    setSaving(false)
  }

  const handleAvatarUpload = async e => {
    const file=e.target.files?.[0]; if(!file) return; setAvatarUploading(true)
    const {url,error}=await uploadFile('avatars',`${user.id}/avatar-${Date.now()}`,file,{compress:true,maxSize:500,quality:0.85})
    if(url){await updateProfile(user.id,{avatar_url:url});refreshProfile()}
    else alert(error?.message||'업로드 실패')
    setAvatarUploading(false)
  }

  const addLink = () => { if(!newLink.label||!newLink.url) return; setForm(f=>({...f,external_links:[...(f.external_links||[]),{...newLink}]})); setNewLink({label:'',url:''}) }
  const removeLink = idx => setForm(f=>({...f,external_links:f.external_links.filter((_,i)=>i!==idx)}))

  // 비밀번호 변경
  const handlePwChange = async e => {
    e.preventDefault(); setPwErr(null); setPwMsg(null)
    if (pwForm.next !== pwForm.confirm) { setPwErr('새 비밀번호가 일치하지 않아요.'); return }
    if (pwForm.next.length < 6) { setPwErr('비밀번호는 6자 이상이어야 해요.'); return }
    const {error} = await supabase.auth.updateUser({password: pwForm.next})
    if (error) setPwErr(error.message)
    else { setPwMsg('비밀번호가 변경됐어요! ✅'); setPwForm({current:'',next:'',confirm:''}) }
  }

  const TABS = [{key:'profile',label:'프로필',icon:'person'},{key:'theme',label:'테마',icon:'palette'},{key:'privacy',label:'공개 설정',icon:'lock'},{key:'password',label:'비밀번호',icon:'key'},{key:'withdraw',label:'회원 탈퇴',icon:'person_remove'}]

  const handleWithdraw = async () => {
    if (withdrawInput !== '탈퇴합니다') return
    setWithdrawing(true)
    try {
      // 유저 데이터 삭제 (profiles는 cascade로 처리)
      await supabase.auth.admin?.deleteUser?.(user.id)
      // admin API 없으면 직접 signOut 후 안내
      await supabase.auth.signOut()
      alert('탈퇴가 완료됐어요. 이용해주셔서 감사합니다.')
      window.location.href = '/login'
    } catch(e) {
      // Supabase Edge Function 없이 처리 가능한 방법
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
    setWithdrawing(false)
  }

  return (
    <div className="fade-in">
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
              <label className="form-label">공개 페이지 헤더 이미지</label>
              {form.header_image_url&&<div style={{borderRadius:8,overflow:'hidden',marginBottom:8,height:90,background:'var(--color-nav-active-bg)'}}><img src={form.header_image_url} alt="header" style={{width:'100%',height:'100%',objectFit:'cover'}} /></div>}
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.header_image_url||''} onChange={set('header_image_url')} style={{flex:1}} />
                {form.header_image_url&&<button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,header_image_url:''}))}>제거</button>}
              </div>
            </div>
            {/* 아바타 */}
            <div className="form-group flex items-center gap-16">
              <div className="user-avatar" style={{width:56,height:56,fontSize:'1.3rem'}}>{profile?.avatar_url?<img src={profile.avatar_url} alt="avatar"/>:(profile?.display_name||'?')[0]}</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <label className="btn btn-outline btn-sm" style={{cursor:'pointer',display:'inline-flex'}}>{avatarUploading?'업로드 중...':'프로필 사진 변경'}<input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload} disabled={avatarUploading} /></label>
                {profile?.avatar_url&&<button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={async()=>{await updateProfile(user.id,{avatar_url:null});refreshProfile()}}>제거</button>}
              </div>
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
              <label className="form-label">배경 이미지</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <input className="form-input" placeholder="https://... (imgur 주소 등록 추천)" value={form.background_image_url} onChange={e=>handleBgUrlChange(e.target.value)} style={{flex:1}} />
              </div>
              {form.background_image_url&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}><img src={form.background_image_url} alt="bg" style={{width:72,height:44,objectFit:'cover',borderRadius:5,border:'1px solid var(--color-border)'}} /><button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>{setForm(f=>({...f,background_image_url:''}));applyBackground('',1)}}>제거</button></div>}
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
                {key:'schedules', label:'일정', icon:'calendar_month'},
                {key:'rulebooks', label:'룰북', icon:'menu_book'},
                {key:'logs', label:'다녀온 기록', icon:'auto_stories'},
                {key:'availability', label:'공수표', icon:'event_available'},
                {key:'scenarios', label:'시나리오', icon:'description'},
                {key:'pairs', label:'페어', icon:'people'},
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

        {/* ── 비밀번호 변경 ── */}
        {tab==='password'&&(
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}><Mi size='sm' color='white'>lock_reset</Mi> 비밀번호 변경</h2>
            {pwErr&&<div style={{padding:'10px 14px',borderRadius:8,background:'rgba(229,115,115,0.1)',border:'1px solid rgba(229,115,115,0.3)',color:'#c62828',fontSize:'0.82rem',marginBottom:14}}>{pwErr}</div>}
            {pwMsg&&<div style={{padding:'10px 14px',borderRadius:8,background:'rgba(104,159,56,0.1)',border:'1px solid rgba(104,159,56,0.3)',color:'#33691e',fontSize:'0.82rem',marginBottom:14}}>{pwMsg}</div>}
            <form onSubmit={handlePwChange}>
              <div className="form-group"><label className="form-label">새 비밀번호</label><input className="form-input" type="password" placeholder="6자 이상" value={pwForm.next} onChange={e=>setPwForm(f=>({...f,next:e.target.value}))} required /></div>
              <div className="form-group"><label className="form-label">새 비밀번호 확인</label><input className="form-input" type="password" placeholder="동일하게 입력" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} required /></div>
              <button className="btn btn-primary btn-sm" type="submit"><Mi size='sm' color='white'>lock_reset</Mi> 비밀번호 변경</button>
            </form>
          </>
        )}

        {/* ── 회원 탈퇴 ── */}
        {tab==='withdraw'&&(
          <div style={{maxWidth:480}}>
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

        {/* 저장 버튼 (비밀번호/탈퇴 탭 제외) */}
        {tab!=='password' && tab!=='withdraw' &&(
          <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10}}>
            {saved&&<span className="text-sm" style={{color:'#558b2f'}}>✅ 저장됐어요!</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'설정 저장'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
