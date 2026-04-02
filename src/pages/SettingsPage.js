// src/pages/SettingsPage.js
import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { updateProfile, uploadFile } from '../lib/supabase'

const PRESET_COLORS = [
  { name: '황토 다이어리', primary: '#c8a96e', bg: '#faf6f0', accent: '#8b6f47' },
  { name: '심야 블루', primary: '#6b8cba', bg: '#f0f2f8', accent: '#3a5a8c' },
  { name: '숲속 초록', primary: '#7aaa7a', bg: '#f2f8f2', accent: '#4a7a4a' },
  { name: '장미 핑크', primary: '#c47a8a', bg: '#fdf2f4', accent: '#8c4a5a' },
  { name: '라벤더', primary: '#9b89c4', bg: '#f5f2fb', accent: '#6a4a9c' },
  { name: '먹물 흑백', primary: '#666666', bg: '#f8f8f8', accent: '#333333' },
]

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return [200, 169, 110]
  try { return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)] }
  catch { return [200, 169, 110] }
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    theme_color: profile?.theme_color || '#c8a96e',
    theme_bg_color: profile?.theme_bg_color || '#faf6f0',
    theme_accent: profile?.theme_accent || '#8b6f47',
    background_image_url: profile?.background_image_url || '',
    bg_opacity: profile?.bg_opacity !== undefined ? profile.bg_opacity : 1,
    is_public: profile?.is_public ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [tab, setTab] = useState('profile')

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const applyPreset = (p) => {
    setForm(f => ({...f, theme_color: p.primary, theme_bg_color: p.bg, theme_accent: p.accent}))
    applyTheme(p.primary, p.bg, p.accent)
  }

  const handleColorChange = (key, value) => {
    const updated = {...form, [key]: value}
    setForm(updated)
    applyTheme(updated.theme_color, updated.theme_bg_color, updated.theme_accent)
  }

  const handleOpacityChange = (value) => {
    const opacity = parseFloat(value)
    setForm(f => ({...f, bg_opacity: opacity}))
    applyBackground(form.background_image_url, opacity)
  }

  const handleBgUrlChange = (value) => {
    setForm(f => ({...f, background_image_url: value}))
    applyBackground(value, form.bg_opacity)
  }

  const save = async () => {
    setSaving(true)
    const { error } = await updateProfile(user.id, form)
    if (!error) {
      refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      applyTheme(form.theme_color, form.theme_bg_color, form.theme_accent)
      applyBackground(form.background_image_url, form.bg_opacity)
    }
    setSaving(false)
  }

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { url, error } = await uploadFile('backgrounds', `${user.id}/bg-${Date.now()}`, file)
    if (url) {
      setForm(f => ({...f, background_image_url: url}))
      applyBackground(url, form.bg_opacity)
    } else alert('업로드 실패: ' + (error?.message || '스토리지 권한을 확인해주세요'))
    setUploading(false)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    const { url, error } = await uploadFile('avatars', `${user.id}/avatar-${Date.now()}`, file)
    if (url) { await updateProfile(user.id, { avatar_url: url }); refreshProfile() }
    else alert('업로드 실패: ' + (error?.message || '스토리지 권한을 확인해주세요'))
    setAvatarUploading(false)
  }

  const TABS = [
    { key: 'profile', label: '👤 프로필' },
    { key: 'theme', label: '🎨 테마' },
    { key: 'privacy', label: '🔒 공개 설정' },
  ]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">⚙️ 환경설정</h1>
        <p className="page-subtitle">나만의 TRPG 다이어리를 꾸며보세요</p>
      </div>

      <div className="flex gap-8" style={{marginBottom:24}}>
        {TABS.map(t => (
          <button key={t.key} className={`btn ${tab===t.key?'btn-primary':'btn-outline'}`} onClick={()=>setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-lg" style={{maxWidth:560}}>

        {/* ── 프로필 ── */}
        {tab === 'profile' && (
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}>프로필 설정</h2>
            <div className="form-group flex items-center gap-16">
              <div className="user-avatar" style={{width:56,height:56,fontSize:'1.3rem'}}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" /> : (profile?.display_name||'?')[0]}
              </div>
              <div>
                <label className="btn btn-outline btn-sm" style={{cursor:'pointer',display:'inline-flex'}}>
                  {avatarUploading ? '업로드 중...' : '프로필 사진 변경'}
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload} disabled={avatarUploading} />
                </label>
                <div className="text-xs text-light" style={{marginTop:5}}>JPG, PNG (최대 2MB)</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">사용자명 (URL)</label>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span className="text-light text-sm">{window.location.origin}/u/</span>
                <input className="form-input" value={profile?.username||''} disabled style={{flex:1,opacity:0.6}} />
              </div>
              <div className="text-xs text-light" style={{marginTop:3}}>사용자명은 변경할 수 없어요</div>
            </div>
            <div className="form-group">
              <label className="form-label">표시 이름</label>
              <input className="form-input" placeholder="모험가 홍길동" value={form.display_name} onChange={set('display_name')} />
            </div>
            <div className="form-group">
              <label className="form-label">소개</label>
              <textarea className="form-textarea" placeholder="TRPG 몇 년차 플레이어예요..." value={form.bio} onChange={set('bio')} style={{minHeight:72}} />
            </div>
          </>
        )}

        {/* ── 테마 ── */}
        {tab === 'theme' && (
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}>테마 & 디자인</h2>

            <div className="form-group">
              <label className="form-label">프리셋 테마</label>
              <div className="grid-3" style={{gap:8}}>
                {PRESET_COLORS.map(p => (
                  <button key={p.name} onClick={()=>applyPreset(p)}
                    style={{
                      padding:'10px 6px', borderRadius:8, cursor:'pointer',
                      border:`2px solid ${form.theme_color===p.primary?'var(--color-text)':'transparent'}`,
                      background:p.bg, textAlign:'center', transition:'all 0.2s'
                    }}
                  >
                    <div style={{display:'flex',justifyContent:'center',gap:3,marginBottom:5}}>
                      {[p.primary,p.accent,p.bg].map((c,i) => (
                        <div key={i} style={{width:13,height:13,borderRadius:'50%',background:c,border:'1px solid rgba(0,0,0,0.1)'}} />
                      ))}
                    </div>
                    <div style={{fontSize:'0.68rem',color:p.accent,fontWeight:600}}>{p.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-3" style={{marginBottom:16}}>
              {[
                {label:'메인 컬러', key:'theme_color'},
                {label:'배경 컬러', key:'theme_bg_color'},
                {label:'강조 컬러', key:'theme_accent'},
              ].map(({label, key}) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="color" value={form[key]}
                      onChange={e => handleColorChange(key, e.target.value)}
                      style={{width:36,height:32,border:'none',cursor:'pointer',borderRadius:5,padding:2}} />
                    <input className="form-input" value={form[key]}
                      onChange={e => handleColorChange(key, e.target.value)}
                      style={{flex:1,fontFamily:'monospace',fontSize:'0.75rem'}} />
                  </div>
                </div>
              ))}
            </div>

            {/* 배경 이미지 */}
            <div className="form-group">
              <label className="form-label">배경 이미지</label>
              <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
                <input className="form-input" placeholder="https://... 이미지 URL"
                  value={form.background_image_url}
                  onChange={e => handleBgUrlChange(e.target.value)}
                  style={{flex:1}} />
                <label className="btn btn-outline btn-sm" style={{cursor:'pointer',whiteSpace:'nowrap'}}>
                  {uploading ? '업로드 중...' : '📁 파일 업로드'}
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleBgUpload} disabled={uploading} />
                </label>
              </div>
              {form.background_image_url && (
                <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                  <img src={form.background_image_url} alt="bg preview"
                    style={{width:72,height:44,objectFit:'cover',borderRadius:5,border:'1px solid var(--color-border)'}} />
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}}
                    onClick={() => { setForm(f=>({...f,background_image_url:''})); applyBackground('', 1) }}>
                    제거
                  </button>
                </div>
              )}
            </div>

            {/* 배경 불투명도 슬라이더 */}
            {form.background_image_url && (
              <div className="form-group">
                <label className="form-label">
                  배경 이미지 불투명도
                  <span style={{marginLeft:8,color:'var(--color-accent)',fontWeight:700}}>
                    {Math.round(form.bg_opacity * 100)}%
                  </span>
                </label>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className="text-xs text-light">흐리게</span>
                  <input
                    type="range"
                    min="0.1" max="1" step="0.05"
                    value={form.bg_opacity}
                    onChange={e => handleOpacityChange(e.target.value)}
                    style={{
                      flex:1, height:4, cursor:'pointer',
                      accentColor:'var(--color-primary)'
                    }}
                  />
                  <span className="text-xs text-light">선명하게</span>
                </div>
                <div className="text-xs text-light" style={{marginTop:4}}>
                  💡 낮을수록 배경이 흐려져 글자가 잘 보여요
                </div>
              </div>
            )}

            {/* 미리보기 */}
            <div style={{padding:14,borderRadius:8,background:form.theme_bg_color,border:`2px solid ${form.theme_color}30`}}>
              <div style={{color:form.theme_accent,fontSize:'0.85rem',fontWeight:700,marginBottom:6}}>✦ 미리보기</div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{padding:'5px 12px',borderRadius:6,background:form.theme_color,color:'white',fontSize:'0.76rem',boxShadow:`0 1px 8px ${form.theme_color}55`}}>버튼</div>
                <div style={{padding:'5px 12px',borderRadius:6,background:`rgba(${hexToRgb(form.theme_color).join(',')},0.12)`,color:form.theme_accent,fontSize:'0.76rem'}}>활성 메뉴</div>
                <div style={{padding:'2px 8px',borderRadius:100,background:`rgba(${hexToRgb(form.theme_color).join(',')},0.15)`,color:form.theme_accent,fontSize:'0.66rem',fontWeight:600}}>배지</div>
              </div>
            </div>
          </>
        )}

        {/* ── 공개 설정 ── */}
        {tab === 'privacy' && (
          <>
            <h2 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:20,fontSize:'1rem'}}>공개 설정</h2>
            <div className="card" style={{marginBottom:14,background:'var(--color-nav-active-bg)'}}>
              <div className="flex justify-between items-center">
                <div>
                  <div style={{fontWeight:600,marginBottom:3,fontSize:'0.9rem'}}>공개 페이지 활성화</div>
                  <div className="text-sm text-light">다른 사람이 내 페이지를 볼 수 있어요</div>
                  {profile?.username && (
                    <div className="text-xs" style={{marginTop:5,color:'var(--color-accent)'}}>
                      🔗 {window.location.origin}/u/{profile.username}
                    </div>
                  )}
                </div>
                <div onClick={()=>setForm(f=>({...f,is_public:!f.is_public}))}
                  style={{width:40,height:22,borderRadius:11,background:form.is_public?'var(--color-primary)':'#ccc',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:form.is_public?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}} />
                </div>
              </div>
            </div>
            {form.is_public && (
              <div style={{padding:14,borderRadius:8,background:'rgba(104,159,56,0.08)',border:'1px solid rgba(104,159,56,0.2)'}}>
                <div className="text-sm" style={{color:'#558b2f'}}>
                  ✅ 공개 상태예요.<br/><br/>
                  <strong>{window.location.origin}/u/{profile?.username}</strong>
                </div>
                <button className="btn btn-outline btn-sm" style={{marginTop:10}}
                  onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/u/${profile?.username}`);alert('복사됐어요!')}}>
                  링크 복사
                </button>
              </div>
            )}
          </>
        )}

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10}}>
          {saved && <span className="text-sm" style={{color:'#558b2f'}}>✅ 저장됐어요!</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
