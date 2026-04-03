// src/pages/GuestbookPage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { guestbookApi, supabase } from '../lib/supabase'

export function GuestbookPage({ ownerId }) {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('message') // 'message' | 'mypage'
  const [messages, setMessages] = useState([])
  const [mypages, setMypages] = useState([])
  const [loading, setLoading] = useState(true)
  const [msgForm, setMsgForm] = useState({ content: '', is_private: false })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyAdded, setAlreadyAdded] = useState(false)

  const isOwner = user && ownerId && user.id === ownerId

  const load = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data: all } = await supabase
      .from('guestbook')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })

    const msgs = (all||[]).filter(g => g.type === 'message' || !g.type)
    const pages = (all||[]).filter(g => g.type === 'mypage')
    setMessages(msgs)
    setMypages(pages)

    // 이미 내 페이지 남겼는지 확인
    if (user) {
      const already = pages.some(p => p.author_id === user.id)
      setAlreadyAdded(already)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [ownerId, user])

  const submitMessage = async () => {
    if (!msgForm.content.trim()) return
    setSubmitting(true)
    await supabase.from('guestbook').insert({
      owner_id: ownerId,
      author_id: user?.id || null,
      author_name: profile?.display_name || profile?.username || '익명',
      content: msgForm.content.trim(),
      is_private: msgForm.is_private,
      type: 'message',
    })
    setMsgForm({ content: '', is_private: false })
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2500)
    load()
    setSubmitting(false)
  }

  const submitMyPage = async () => {
    if (!user || !profile) { alert('로그인 후 이용해주세요!'); return }
    if (alreadyAdded) { alert('이미 내 페이지를 남겼어요!'); return }
    setSubmitting(true)
    await supabase.from('guestbook').insert({
      owner_id: ownerId,
      author_id: user.id,
      author_name: profile.display_name || profile.username,
      author_username: profile.username,
      author_avatar_url: profile.avatar_url || null,
      content: profile.display_name || profile.username,
      type: 'mypage',
    })
    setAlreadyAdded(true)
    load()
    setSubmitting(false)
  }

  const removeEntry = async (id) => {
    await supabase.from('guestbook').delete().eq('id', id)
    load()
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('ko-KR', { year:'2-digit', month:'numeric', day:'numeric' })

  return (
    <div style={{ marginTop: 0 }}>
      {/* 탭 */}
      <div className="flex gap-8" style={{ marginBottom: 20 }}>
        <button className={`btn btn-sm ${tab==='message'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('message')}>
          💌 방명록 ({messages.length})
        </button>
        <button className={`btn btn-sm ${tab==='mypage'?'btn-primary':'btn-outline'}`} onClick={()=>setTab('mypage')}>
          🔗 내 페이지 남기기 ({mypages.length})
        </button>
      </div>

      {/* ── 방명록 ── */}
      {tab === 'message' && (
        <div>
          {/* 작성 폼 */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <textarea
                className="form-textarea"
                placeholder="방명록을 남겨보세요 💌"
                value={msgForm.content}
                onChange={e => setMsgForm(f => ({...f, content: e.target.value}))}
                style={{ minHeight: 80 }}
              />
            </div>
            <div className="flex justify-between items-center">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'var(--color-text-light)', cursor:'pointer' }}>
                <input type="checkbox" checked={msgForm.is_private} onChange={e=>setMsgForm(f=>({...f,is_private:e.target.checked}))} />
                🔒 비공개
              </label>
              <div className="flex items-center gap-10">
                {submitted && <span className="text-sm" style={{color:'#558b2f'}}>✅ 남겼어요!</span>}
                <button className="btn btn-primary btn-sm" onClick={submitMessage} disabled={submitting||!msgForm.content.trim()}>
                  {submitting ? '저장 중...' : '방명록 남기기'}
                </button>
              </div>
            </div>
          </div>

          {/* 목록 */}
          {loading ? (
            <div className="text-sm text-light" style={{textAlign:'center',padding:20}}>불러오는 중...</div>
          ) : messages.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:32,color:'var(--color-text-light)',fontSize:'0.85rem'}}>아직 방명록이 없어요</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {messages.map(g => {
                const isHidden = g.is_private && !isOwner && g.author_id !== user?.id
                return (
                  <div key={g.id} className="card card-sm">
                    <div className="flex justify-between items-start" style={{ marginBottom: 6 }}>
                      <div className="flex items-center gap-8">
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.author_name || '익명'}</span>
                        {g.is_private && <span className="badge badge-gray" style={{fontSize:'0.62rem'}}>🔒 비공개</span>}
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-xs text-light">{fmtDate(g.created_at)}</span>
                        {(isOwner || g.author_id === user?.id) && (
                          <button className="btn btn-ghost btn-sm" style={{color:'#e57373',padding:'1px 6px'}} onClick={()=>removeEntry(g.id)}>삭제</button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize:'0.85rem', color:'var(--color-text-light)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                      {isHidden ? '🔒 비공개 메시지예요' : g.content}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 내 페이지 남기기 ── */}
      {tab === 'mypage' && (
        <div>
          {/* 내 페이지 남기기 버튼 */}
          {user && ownerId !== user.id && (
            <div className="card" style={{ marginBottom: 16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize:'0.9rem', marginBottom: 3 }}>내 페이지 남기기</div>
                <div className="text-xs text-light">이 페이지에 내 공개 페이지 링크를 남겨요</div>
              </div>
              {alreadyAdded ? (
                <span className="text-sm" style={{color:'#558b2f'}}>✅ 이미 남겼어요</span>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={submitMyPage} disabled={submitting}>
                  {submitting ? '추가 중...' : '🔗 내 페이지 남기기'}
                </button>
              )}
            </div>
          )}
          {!user && (
            <div className="card" style={{ marginBottom: 16, textAlign:'center', padding:20, color:'var(--color-text-light)', fontSize:'0.85rem' }}>
              로그인 후 내 페이지를 남길 수 있어요
            </div>
          )}

          {/* 남긴 페이지 목록 */}
          {loading ? (
            <div className="text-sm text-light" style={{textAlign:'center',padding:20}}>불러오는 중...</div>
          ) : mypages.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:32,color:'var(--color-text-light)',fontSize:'0.85rem'}}>아직 남긴 페이지가 없어요</div>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {mypages.map(g => (
                <div key={g.id} style={{ position:'relative' }}>
                  <a href={`/u/${g.author_username}`} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:100, background:'var(--color-nav-active-bg)', border:'1px solid var(--color-border)', textDecoration:'none', color:'var(--color-text)', transition:'all 0.15s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--color-primary)';e.currentTarget.style.color='white';e.currentTarget.style.borderColor='var(--color-primary)'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--color-nav-active-bg)';e.currentTarget.style.color='var(--color-text)';e.currentTarget.style.borderColor='var(--color-border)'}}
                  >
                    <div style={{ width:28, height:28, borderRadius:'50%', overflow:'hidden', background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.76rem', color:'white', fontWeight:700, flexShrink:0 }}>
                      {g.author_avatar_url
                        ? <img src={g.author_avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : (g.author_name||'?')[0]
                      }
                    </div>
                    <span style={{ fontSize:'0.85rem', fontWeight:500 }}>{g.author_name}</span>
                    <span style={{ fontSize:'0.72rem', opacity:0.7 }}>@{g.author_username}</span>
                  </a>
                  {(isOwner || g.author_id === user?.id) && (
                    <button
                      style={{ position:'absolute', top:-4, right:-4, width:18, height:18, borderRadius:'50%', background:'#e57373', border:'none', cursor:'pointer', fontSize:'0.6rem', color:'white', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
                      onClick={()=>removeEntry(g.id)}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
