// src/pages/AuthPage.js
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../lib/supabase'

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    setError(''); setSuccess('')
    if (!form.email || !form.password) { setError('이메일과 비밀번호를 입력해주세요.'); return }

    setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError('이메일 또는 비밀번호가 올바르지 않아요.')
      else navigate('/dashboard')
    } else {
      if (!form.username) { setError('사용자명을 입력해주세요.'); setLoading(false); return }
      if (form.username.length < 3) { setError('사용자명은 3자 이상이어야 해요.'); setLoading(false); return }
      const { error } = await signUp(form.email, form.password, form.username, form.displayName || form.username)
      if (error) {
        if (error.message.includes('already registered')) setError('이미 사용 중인 이메일이에요.')
        else setError(error.message)
      } else {
        setSuccess('가입 확인 메일을 보냈어요! 메일을 확인해주세요. ✉️')
      }
    }
    setLoading(false)
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>✦ TRPG Diary</h1>
          <p>나만의 TRPG 기록을 남겨보세요</p>
        </div>

        <div className="flex gap-8" style={{ marginBottom: 28 }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              className={`btn ${mode === m ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <>
            <div className="form-group">
              <label className="form-label">사용자명 * (URL에 사용됩니다)</label>
              <input className="form-input" placeholder="trpg_lover" value={form.username} onChange={set('username')} />
            </div>
            <div className="form-group">
              <label className="form-label">표시 이름</label>
              <input className="form-input" placeholder="모험가 홍길동" value={form.displayName} onChange={set('displayName')} />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">이메일 *</label>
          <input className="form-input" type="email" placeholder="dice@trpg.com" value={form.email} onChange={set('email')} />
        </div>

        <div className="form-group">
          <label className="form-label">비밀번호 *</label>
          <input className="form-input" type="password" placeholder="8자 이상" value={form.password} onChange={set('password')}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {error && (
          <div style={{ background: 'rgba(229,115,115,0.1)', border: '1px solid rgba(229,115,115,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.84rem', color: '#c62828' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(104,159,56,0.1)', border: '1px solid rgba(104,159,56,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.84rem', color: '#558b2f' }}>
            {success}
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          style={{ justifyContent: 'center', padding: '12px' }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '처리 중...' : mode === 'login' ? '✦ 로그인' : '✦ 가입하기'}
        </button>

        {mode === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
            아직 계정이 없으신가요?{' '}
            <span style={{ color: 'var(--color-accent)', cursor: 'pointer' }} onClick={() => setMode('register')}>
              회원가입
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
