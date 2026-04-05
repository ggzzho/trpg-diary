// src/pages/AuthPage.js
import React, { useState } from 'react'
import { signUp, signIn, supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [form, setForm] = useState({ email:'', password:'', username:'', displayName:'' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const handleLogin = async e => {
    e.preventDefault(); setLoading(true); setError(null)
    const { error } = await signIn(form.email, form.password)
    if (error) setError('이메일 또는 비밀번호가 올바르지 않아요.')
    else navigate('/dashboard')
    setLoading(false)
  }

  const handleSignup = async e => {
    e.preventDefault(); setLoading(true); setError(null)
    if (!form.username || !/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError('사용자명은 영문, 숫자, 밑줄(_)만 사용 가능해요.'); setLoading(false); return
    }
    const { error } = await signUp(form.email, form.password, form.username, form.displayName||form.username)
    if (error) setError(error.message)
    else setMessage('가입 확인 메일을 보냈어요! 메일을 확인해주세요. 📬')
    setLoading(false)
  }

  const handleReset = async e => {
    e.preventDefault(); setLoading(true); setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: 'https://www.trpg-diary.co.kr/reset-password'
    })
    if (error) setError(error.message)
    else setMessage('비밀번호 재설정 링크를 이메일로 보냈어요! 📬')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-bg)', padding:20 }}>
      <div className="card card-lg" style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ marginBottom:12, display:'flex', justifyContent:'center' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M28 4 L31.5 22.5 L50 28 L31.5 33.5 L28 52 L24.5 33.5 L6 28 L24.5 22.5 Z"
                fill="var(--color-primary)" opacity="0.9"/>
              <path d="M28 10 L30.5 23.5 L44 28 L30.5 32.5 L28 46 L25.5 32.5 L12 28 L25.5 23.5 Z"
                fill="var(--color-accent)" opacity="0.6"/>
            </svg>
          </div>
          <h1 style={{ fontWeight:800, color:'var(--color-accent)', fontSize:'1.5rem', letterSpacing:'-0.03em' }}>TRPG Diary</h1>
          <p className="text-sm text-light" style={{ marginTop:4 }}>나만의 TRPG 기록 다이어리</p>
        </div>

        {/* 탭 */}
        {mode !== 'reset' && (
          <div className="flex" style={{ marginBottom:20, borderBottom:'1px solid var(--color-border)' }}>
            {[{k:'login',l:'로그인'},{k:'signup',l:'회원가입'}].map(t=>(
              <button key={t.k} onClick={()=>{setMode(t.k);setError(null);setMessage(null)}}
                style={{ flex:1, padding:'8px 0', background:'none', border:'none', cursor:'pointer', fontWeight:mode===t.k?700:400, color:mode===t.k?'var(--color-accent)':'var(--color-text-light)', borderBottom:mode===t.k?'2px solid var(--color-accent)':'2px solid transparent', transition:'all 0.2s', fontSize:'0.88rem' }}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <h2 style={{ fontWeight:700, color:'var(--color-accent)', marginBottom:20, fontSize:'1rem' }}>🔑 비밀번호 찾기</h2>
        )}

        {error && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(229,115,115,0.1)', border:'1px solid rgba(229,115,115,0.3)', color:'#c62828', fontSize:'0.82rem', marginBottom:14 }}>{error}</div>}
        {message && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(104,159,56,0.1)', border:'1px solid rgba(104,159,56,0.3)', color:'#33691e', fontSize:'0.82rem', marginBottom:14 }}>{message}</div>}

        {/* 로그인 */}
        {mode === 'login' && !message && (
          <form onSubmit={handleLogin}>
            <div className="form-group"><label className="form-label">이메일</label><input className="form-input" type="email" placeholder="hello@example.com" value={form.email} onChange={set('email')} required /></div>
            <div className="form-group"><label className="form-label">비밀번호</label><input className="form-input" type="password" placeholder="비밀번호" value={form.password} onChange={set('password')} required /></div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop:8, justifyContent:'center' }}>{loading?'로그인 중...':'로그인'}</button>
            <button type="button" className="btn btn-ghost btn-sm w-full" style={{ marginTop:8, justifyContent:'center', color:'var(--color-text-light)' }} onClick={()=>{setMode('reset');setError(null);setMessage(null)}}>
              비밀번호를 잊으셨나요?
            </button>
          </form>
        )}

        {/* 회원가입 */}
        {mode === 'signup' && !message && (
          <form onSubmit={handleSignup}>
            <div className="form-group"><label className="form-label">이메일</label><input className="form-input" type="email" placeholder="hello@example.com" value={form.email} onChange={set('email')} required /></div>
            <div className="form-group"><label className="form-label">비밀번호</label><input className="form-input" type="password" placeholder="6자 이상" value={form.password} onChange={set('password')} required minLength={6} /></div>
            <div className="form-group">
              <label className="form-label">사용자명 (URL에 사용)</label>
              <input className="form-input" placeholder="trpg_player (영문, 숫자, _)" value={form.username} onChange={set('username')} required />
              <div className="text-xs text-light" style={{ marginTop:3 }}>https://trpg-diary.co.kr/u/{form.username||'...'}</div>
            </div>
            <div className="form-group"><label className="form-label">표시 이름</label><input className="form-input" placeholder="모험가 홍길동" value={form.displayName} onChange={set('displayName')} /></div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop:8, justifyContent:'center' }}>{loading?'가입 중...':'가입하기'}</button>
          </form>
        )}

        {/* 비밀번호 찾기 */}
        {mode === 'reset' && !message && (
          <form onSubmit={handleReset}>
            <div className="form-group"><label className="form-label">가입한 이메일</label><input className="form-input" type="email" placeholder="hello@example.com" value={form.email} onChange={set('email')} required /></div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop:8, justifyContent:'center' }}>{loading?'전송 중...':'재설정 링크 보내기'}</button>
            <button type="button" className="btn btn-ghost btn-sm w-full" style={{ marginTop:8, justifyContent:'center' }} onClick={()=>{setMode('login');setError(null);setMessage(null)}}>← 로그인으로 돌아가기</button>
          </form>
        )}
      </div>
    </div>
  )
}
