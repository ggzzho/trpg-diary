// src/pages/SettingsPage.js
import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile, uploadFile } from '../lib/supabase'

const PRESET_COLORS = [
  { name: '황토 다이어리', primary: '#c8a96e', bg: '#faf6f0', accent: '#8b6f47' },
  { name: '심야 블루', primary: '#6b8cba', bg: '#f0f2f8', accent: '#3a5a8c' },
  { name: '숲속 초록', primary: '#7aaa7a', bg: '#f2f8f2', accent: '#4a7a4a' },
  { name: '장미 핑크', primary: '#c47a8a', bg: '#fdf2f4', accent: '#8c4a5a' },
  { name: '라벤더', primary: '#9b89c4', bg: '#f5f2fb', accent: '#6a4a9c' },
  { name: '먹물 흑백', primary: '#666666', bg: '#f8f8f8', accent: '#333333' },
]

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    theme_color: profile?.theme_color || '#c8a96e',
    theme_bg_color: profile?.theme_bg_color || '#faf6f0',
    theme_accent: profile?.theme_accent || '#8b6f47',
    background_image_url: profile?.background_image_url || '',
    is_public: profile?.is_public ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [tab, setTab] = useState('profile')

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const applyPreset = (p) => setForm(f => ({...f, theme_color: p.primary, theme_bg_color: p.bg, theme_accent: p.accent}))

  const save = async () => {
    setSaving(true)
    const { error } = await updateProfile(user.id, form)
    if (!error) {
      refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      // 테마 즉시 적용
      document.documentElement.style.setProperty('--color-primary', form.theme_color)
      document.documentElement.style.setProperty('--color-bg', form.theme_bg_color)
      document.documentElement.style.setProperty('--color-accent', form.theme_accent)
      if (form.background_image_url) {
        document.body.style.backgroundImage = `url(${form.background_image_url})`
        document.body.style.backgroundSize = 'cover'
        document.body.style.backgroundAttachment = 'fixed'
      } else {
        document.body.style.backgroundImage = ''
      }
    }
    setSaving(false)
  }

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { url, error } = await uploadFile('backgrounds', `${user.id}/bg-${Date.now()}`, file)
    if (url) setForm(f => ({...f, background_image_url: url}))
    else alert('업로드 실패: ' + error?.message)
    setUploading(false)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    const { url, error } = await uploadFile('avatars', `${user.id}/avatar-${Date.now()}`, file)
    if (url) {
      await updateProfile(user.id, { avatar_url: url })
      refreshProfile()
    } else alert('업로드 실패: ' + error?.message)
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

      <div className="flex gap-8" style={{marginBottom:28}}>
        {TABS.map(t => (
          <button key={t.key} className={`btn ${tab===t.key?'btn-primary':'btn-outline'}`} onClick={()=>setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-lg" style={{maxWidth:600}}>

        {/* ── 프로필 ── */}
        {tab === 'profile' && (
          <>
            <h2 className="text-serif" style={{color:'var(--color-accent)',marginBottom:24}}>프로필 설정</h2>

            {/* 아바타 */}
            <div className="form-group flex items-center gap-16">
              <div className="user-avatar" style={{width:64,height:64,fontSize:'1.5rem'}}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" />
                  : (profile?.display_name||'?')[0]
                }
              </div>
              <div>
                <label className="btn btn-outline btn-sm" style={{cursor:'pointer',display:'inline-flex'}}>
                  {avatarUploading ? '업로드 중...' : '프로필 사진 변경'}
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarUpload} disabled={avatarUploading} />
                </label>
                <div className="text-xs text-light" style={{marginTop:6}}>JPG, PNG, GIF (최대 2MB)</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">사용자명 (URL)</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="text-light text-sm">{window.location.origin}/u/</span>
                <input className="form-input" value={profile?.username||''} disabled style={{flex:1,opacity:0.6}} />
              </div>
              <div className="text-xs text-light" style={{marginTop:4}}>사용자명은 변경할 수 없어요</div>
            </div>

            <div className="form-group">
              <label className="form-label">표시 이름</label>
              <input className="form-input" placeholder="모험가 홍길동" value={form.display_name} onChange={set('display_name')} />
            </div>

            <div className="form-group">
              <label className="form-label">소개</label>
              <textarea className="form-textarea" placeholder="TRPG 몇 년차 플레이어예요. CoC를 주로 즐깁니다 🎲" value={form.bio} onChange={set('bio')} style={{minHeight:80}} />
            </div>
          </>
        )}

        {/* ── 테마 ── */}
        {tab === 'theme' && (
          <>
            <h2 className="text-serif" style={{color:'var(--color-accent)',marginBottom:24}}>테마 & 디자인</h2>

            <div className="form-group">
              <label className="form-label">프리셋 테마</label>
              <div className="grid-3" style={{gap:10}}>
                {PRESET_COLORS.map(p => (
                  <button key={p.name} onClick={()=>applyPreset(p)}
                    style={{
                      padding:'12px 8px', borderRadius:10, cursor:'pointer',
                      border:`2px solid ${form.theme_color===p.primary?'var(--color-text)':'transparent'}`,
                      background:p.bg, textAlign:'center', transition:'all 0.2s'
                    }}
                  >
                    <div style={{display:'flex',justifyContent:'center',gap:4,marginBottom:6}}>
                      {[p.primary, p.accent, p.bg].map((c,i) => (
                        <div key={i} style={{width:16,height:16,borderRadius:'50%',background:c,border:'1px solid rgba(0,0,0,0.1)'}} />
                      ))}
                    </div>
                    <div style={{fontSize:'0.72rem',color:p.accent,fontWeight:500}}>{p.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-3" style={{marginBottom:20}}>
              <div className="form-group">
                <label className="form-label">메인 컬러</label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="color" value={form.theme_color} onChange={set('theme_color')} style={{width:40,height:36,border:'none',cursor:'pointer',borderRadius:6,padding:2}} />
                  <input className="form-input" value={form.theme_color} onChange={set('theme_color')} style={{flex:1,fontFamily:'monospace',fontSize:'0.8rem'}} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">배경 컬러</label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="color" value={form.theme_bg_color} onChange={set('theme_bg_color')} style={{width:40,height:36,border:'none',cursor:'pointer',borderRadius:6,padding:2}} />
                  <input className="form-input" value={form.theme_bg_color} onChange={set('theme_bg_color')} style={{flex:1,fontFamily:'monospace',fontSize:'0.8rem'}} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">강조 컬러</label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="color" value={form.theme_accent} onChange={set('theme_accent')} style={{width:40,height:36,border:'none',cursor:'pointer',borderRadius:6,padding:2}} />
                  <input className="form-input" value={form.theme_accent} onChange={set('theme_accent')} style={{flex:1,fontFamily:'monospace',fontSize:'0.8rem'}} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">배경 이미지</label>
              <div style={{display:'flex',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
                <input className="form-input" placeholder="https://... (이미지 URL 직접 입력)" value={form.background_image_url} onChange={set('background_image_url')} style={{flex:1}} />
                <label className="btn btn-outline" style={{cursor:'pointer',whiteSpace:'nowrap'}}>
                  {uploading ? '업로드 중...' : '📁 파일 업로드'}
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleBgUpload} disabled={uploading} />
                </label>
              </div>
              {form.background_image_url && (
                <div style={{marginTop:10,display:'flex',gap:10,alignItems:'center'}}>
                  <img src={form.background_image_url} alt="bg preview" style={{width:80,height:50,objectFit:'cover',borderRadius:6,border:'1px solid var(--color-border)'}} />
                  <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setForm(f=>({...f,background_image_url:''}))}>제거</button>
                </div>
              )}
            </div>

            {/* 테마 미리보기 */}
            <div style={{padding:16,borderRadius:10,background:form.theme_bg_color,border:`2px solid ${form.theme_color}30`}}>
              <div style={{fontFamily:'var(--font-serif)',color:form.theme_accent,fontSize:'0.95rem',fontWeight:600,marginBottom:8}}>✦ 미리보기</div>
              <div style={{color:form.theme_color,fontSize:'0.82rem'}}>이렇게 보여요 · 카드와 버튼에 적용됩니다</div>
              <div style={{marginTop:10,display:'inline-block',padding:'6px 14px',borderRadius:8,background:form.theme_color,color:'white',fontSize:'0.8rem'}}>버튼 예시</div>
            </div>
          </>
        )}

        {/* ── 공개 설정 ── */}
        {tab === 'privacy' && (
          <>
            <h2 className="text-serif" style={{color:'var(--color-accent)',marginBottom:24}}>공개 설정</h2>

            <div className="card" style={{marginBottom:16,background:'rgba(200,169,110,0.06)'}}>
              <div className="flex justify-between items-center">
                <div>
                  <div style={{fontWeight:600,marginBottom:4}}>공개 페이지 활성화</div>
                  <div className="text-sm text-light">다른 사람이 내 페이지를 볼 수 있어요</div>
                  {profile?.username && (
                    <div className="text-xs" style={{marginTop:6,color:'var(--color-accent)'}}>
                      🔗 {window.location.origin}/u/{profile.username}
                    </div>
                  )}
                </div>
                <label style={{display:'flex',alignItems:'center',cursor:'pointer',gap:8}}>
                  <span className="text-sm text-light">{form.is_public?'공개':'비공개'}</span>
                  <div
                    onClick={()=>setForm(f=>({...f,is_public:!f.is_public}))}
                    style={{
                      width:44,height:24,borderRadius:12,background:form.is_public?'var(--color-primary)':'#ccc',
                      position:'relative',cursor:'pointer',transition:'background 0.2s'
                    }}
                  >
                    <div style={{
                      position:'absolute',top:2,left:form.is_public?22:2,width:20,height:20,
                      borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </label>
              </div>
            </div>

            {form.is_public && (
              <div style={{padding:16,borderRadius:10,background:'rgba(104,159,56,0.08)',border:'1px solid rgba(104,159,56,0.2)'}}>
                <div className="text-sm" style={{color:'#558b2f'}}>
                  ✅ 공개 상태입니다. 아래 링크를 공유하면 다른 분들이 내 다이어리를 볼 수 있어요.
                  <br/><br/>
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

        <div style={{marginTop:24,paddingTop:20,borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end',alignItems:'center',gap:12}}>
          {saved && <span className="text-sm" style={{color:'#558b2f'}}>✅ 저장되었어요!</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
