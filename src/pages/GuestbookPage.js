// src/pages/GuestbookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { guestbookApi } from '../lib/supabase'
import { EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export function GuestbookPage({ ownerId, readOnly }) {
  const { user } = useAuth()
  const targetId = ownerId || user?.id
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ author_name: '', content: '', is_private: false })
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    if (!targetId) return
    const { data } = await guestbookApi.getAll(targetId)
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [targetId])

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  const submit = async () => {
    if (!form.author_name.trim() || !form.content.trim()) return
    setSubmitting(true)
    await guestbookApi.create({
      owner_id: targetId,
      author_id: user?.id || null,
      author_name: form.author_name,
      content: form.content,
      is_private: form.is_private,
    })
    setForm({ author_name: '', content: '', is_private: false })
    load()
    setSubmitting(false)
  }

  const remove = async id => { await guestbookApi.remove(id); load() }

  const canDelete = (item) => user && (user.id === targetId || user.id === item.author_id)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">💌 방명록</h1>
        <p className="page-subtitle">소중한 분들이 남긴 메시지들이에요</p>
      </div>

      {/* 글쓰기 폼 */}
      <div className="card" style={{marginBottom:32}}>
        <h3 className="text-serif" style={{color:'var(--color-accent)',marginBottom:16}}>✉️ 방명록 남기기</h3>
        <div className="form-group">
          <label className="form-label">이름 *</label>
          <input className="form-input" placeholder="모험가 홍길동" value={form.author_name} onChange={set('author_name')} style={{maxWidth:260}} />
        </div>
        <div className="form-group">
          <label className="form-label">내용 *</label>
          <textarea className="form-textarea" placeholder="안녕하세요! 함께 플레이하고 싶어요 🎲" value={form.content} onChange={set('content')} />
        </div>
        <div className="flex justify-between items-center">
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:'0.84rem',color:'var(--color-text-light)',cursor:'pointer'}}>
            <input type="checkbox" checked={form.is_private} onChange={e=>setForm(f=>({...f,is_private:e.target.checked}))} />
            비밀 방명록 (본인과 소유자만 볼 수 있어요)
          </label>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? '저장 중...' : '남기기'}
          </button>
        </div>
      </div>

      {/* 방명록 목록 */}
      {loading ? <LoadingSpinner /> : items.length === 0
        ? <EmptyState icon="💌" title="아직 방명록이 없어요" description="첫 번째 메시지를 남겨보세요!" />
        : <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {items.map(item => (
              <div key={item.id} className="card card-sm" style={{position:'relative'}}>
                {item.is_private && (
                  <div style={{position:'absolute',top:12,right:12}}>
                    <span className="badge badge-gray">🔒 비밀</span>
                  </div>
                )}
                <div className="flex items-center gap-12" style={{marginBottom:10}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--color-primary),var(--color-accent))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'0.9rem',flexShrink:0}}>
                    {(item.author_name||'?')[0]}
                  </div>
                  <div>
                    <div style={{fontWeight:600,fontSize:'0.9rem'}}>{item.author_name}</div>
                    <div className="text-xs text-light">
                      {format(new Date(item.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                    </div>
                  </div>
                </div>
                <p style={{color:'var(--color-text)',lineHeight:1.8,whiteSpace:'pre-wrap',fontSize:'0.9rem'}}>{item.content}</p>
                {canDelete(item) && (
                  <div style={{marginTop:10,display:'flex',justifyContent:'flex-end'}}>
                    <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(item.id)}>삭제</button>
                  </div>
                )}
              </div>
            ))}
          </div>
      }

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>remove(confirm)} message="이 방명록을 삭제하시겠어요?" />
    </div>
  )
}
