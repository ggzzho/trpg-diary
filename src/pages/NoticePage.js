// src/pages/NoticePage.js
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Mi } from '../components/Mi'
import { MarkdownRenderer } from './AdminNoticePage'
import { getTodayKST } from '../lib/dateFormatters'

export default function NoticePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [liking, setLiking] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('notices').select('*').eq('id', id).single()
      if (error || !data) { setNotFound(true); setLoading(false); return }
      setNotice(data)
      setLoading(false)

      // 조회수 증가 (오늘 이미 본 공지는 카운트 안 함)
      const todayStr = getTodayKST()
      const viewKey = `notice_viewed_${id}_${todayStr}`
      if (!localStorage.getItem(viewKey)) {
        await supabase.rpc('increment_notice_view', { notice_id: id })
        localStorage.setItem(viewKey, '1')
      }

      // 좋아요 수 조회
      const { count } = await supabase
        .from('notice_likes').select('*', { count: 'exact', head: true })
        .eq('notice_id', id)
      setLikeCount(count || 0)

      // 본인 좋아요 여부
      if (user) {
        const { data: myLike } = await supabase
          .from('notice_likes').select('user_id')
          .eq('notice_id', id).eq('user_id', user.id).maybeSingle()
        setLiked(!!myLike)
      }
    }
    load()
  }, [id, user])

  const toggleLike = async () => {
    if (!user || liking) return
    setLiking(true)
    if (liked) {
      await supabase.from('notice_likes').delete()
        .eq('notice_id', id).eq('user_id', user.id)
      setLiked(false)
      setLikeCount(c => c - 1)
    } else {
      await supabase.from('notice_likes').insert({ notice_id: id, user_id: user.id })
      setLiked(true)
      setLikeCount(c => c + 1)
    }
    setLiking(false)
  }

  if (loading) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--color-text-light)',fontSize:'0.88rem'}}>불러오는 중...</div>
    </div>
  )

  if (notFound) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <Mi size="lg" style={{fontSize:40,marginBottom:14,color:'var(--color-text-light)'}}>campaign</Mi>
        <p style={{color:'var(--color-text-light)'}}>공지를 찾을 수 없어요.</p>
        <button className="btn btn-outline btn-sm" style={{marginTop:12}} onClick={()=>navigate('/dashboard')}>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  )

  return (
    <div className="fade-in" style={{maxWidth:680,margin:'0 auto',padding:'20px 0 60px'}}>
      <Helmet>
        <title>{notice.title} - TRPG Diary</title>
        <meta property="og:type"        content="article" />
        <meta property="og:title"       content={`${notice.title} - TRPG Diary`} />
        <meta property="og:description" content={notice.content?.slice(0,100)?.replace(/[#*`]/g,'') || 'TRPG Diary 공지사항'} />
        <meta property="og:image"       content="https://trpg-diary.co.kr/og-image.png" />
        <meta property="og:url"         content={`https://trpg-diary.co.kr/notices/${notice.id}`} />
        <meta name="twitter:card"        content="summary" />
        <meta name="twitter:title"       content={`${notice.title} - TRPG Diary`} />
        <meta name="twitter:description" content={notice.content?.slice(0,100)?.replace(/[#*`]/g,'') || 'TRPG Diary 공지사항'} />
      </Helmet>
      <button className="btn btn-ghost btn-sm" style={{marginBottom:20,color:'var(--color-text-light)'}}
        onClick={()=>navigate(-1)}>
        <Mi size="sm" color="light">arrow_back</Mi> 뒤로가기
      </button>

      <div className="card" style={{padding:'28px 32px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          {notice.is_popup && (
            <span className="badge badge-primary" style={{fontSize:'0.65rem'}}>
              <Mi size="sm" color="white">notifications</Mi> 공지
            </span>
          )}
        </div>
        <h1 style={{fontWeight:700,fontSize:'1.3rem',color:'var(--color-accent)',marginBottom:10,lineHeight:1.4}}>
          {notice.title}
        </h1>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          fontSize:'0.78rem',color:'var(--color-text-light)',
          marginBottom:24,paddingBottom:16,borderBottom:'1px solid var(--color-border)'}}>
          <div>
            {new Date(notice.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})} {new Date(notice.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
            {notice.updated_at !== notice.created_at && (
              <span style={{marginLeft:8}}>(수정됨)</span>
            )}
          </div>
          <span style={{display:'flex',alignItems:'center',gap:4}}>
            <Mi size="sm" color="light">visibility</Mi>
            {(notice.view_count||0).toLocaleString()}
          </span>
        </div>

        <MarkdownRenderer content={notice.content} style={{fontSize:'0.92rem',lineHeight:1.9}}/>

        {/* 좋아요 */}
        <div style={{marginTop:28,paddingTop:20,borderTop:'1px solid var(--color-border)',
          display:'flex',justifyContent:'center'}}>
          <button
            onClick={toggleLike}
            disabled={!user || liking}
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 24px',
              borderRadius:100,border:'1px solid',
              borderColor: liked ? '#e57373' : 'var(--color-border)',
              background: liked ? 'rgba(229,115,115,0.08)' : 'transparent',
              color: liked ? '#e57373' : 'var(--color-text-light)',
              cursor: user ? 'pointer' : 'default',
              transition:'all 0.2s',fontSize:'0.9rem',fontWeight:600}}>
            <Mi size="sm" filled={liked} style={{color: liked ? '#e57373' : 'var(--color-text-light)'}}>
              favorite
            </Mi>
            {likeCount > 0 && <span>{likeCount.toLocaleString()}</span>}
            {!user && <span style={{fontSize:'0.78rem',fontWeight:400}}>로그인 후 이용 가능해요</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
