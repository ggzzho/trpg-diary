// src/pages/ResetPasswordPage.js
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState({ next:'', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // 이메일 링크 클릭 시 URL hash에서 세션 토큰 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session) setReady(true)
      }
    })

    // 현재 세션 확인 (이미 토큰이 처리된 경우)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    if (form.next.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return }
    if (form.next !== form.confirm) { setError('비밀번호가 일치하지 않아요.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: form.next })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
    // 3초 후 대시보드로 이동
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--color-bg)', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--color-surface)',
        borderRadius:16, padding:32, border:'1px solid var(--color-border)',
        boxShadow:'0 4px 24px var(--color-shadow)' }}>

        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:'2rem', marginBottom:8 }}>✦</div>
          <h1 style={{ fontWeight:800, color:'var(--color-accent)', fontSize:'1.5rem' }}>TRPG Diary</h1>
          <p style={{ fontSize:'0.85rem', color:'var(--color-text-light)', marginTop:4 }}>비밀번호 재설정</p>
        </div>

        {done ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
            <p style={{ fontWeight:700, color:'var(--color-accent)', marginBottom:8 }}>비밀번호가 변경됐어요!</p>
            <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)' }}>잠시 후 대시보드로 이동해요...</p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign:'center', color:'var(--color-text-light)', padding:'20px 0' }}>
            <p style={{ fontSize:'0.85rem' }}>인증 정보를 확인하는 중...</p>
            <p style={{ fontSize:'0.78rem', marginTop:8 }}>이메일 링크를 통해 접속해주세요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(229,115,115,0.1)',
                border:'1px solid rgba(229,115,115,0.3)', color:'#c62828', fontSize:'0.82rem', marginBottom:14 }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:'0.82rem', fontWeight:600,
                color:'var(--color-text-light)', marginBottom:6 }}>새 비밀번호</label>
              <input className="form-input" type="password" placeholder="6자 이상"
                value={form.next} onChange={e => setForm(f => ({...f, next:e.target.value}))}
                required minLength={6}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:'0.82rem', fontWeight:600,
                color:'var(--color-text-light)', marginBottom:6 }}>새 비밀번호 확인</label>
              <input className="form-input" type="password" placeholder="동일하게 입력"
                value={form.confirm} onChange={e => setForm(f => ({...f, confirm:e.target.value}))}
                required/>
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}
              style={{ justifyContent:'center' }}>
              {loading ? '변경 중...' : '비밀번호 변경하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
