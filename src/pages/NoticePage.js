// src/pages/NoticePage.js
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { MarkdownRenderer } from './AdminNoticePage'

export default function NoticePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('notices').select('*').eq('id', id).single()
      if (error || !data) { setNotFound(true); setLoading(false); return }
      setNotice(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--color-text-light)',fontSize:'0.88rem'}}>불러오는 중...</div>
    </div>
  )

  if (notFound) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <Mi size='lg' style={{fontSize:40,marginBottom:14,color:'var(--color-text-light)'}}>campaign</Mi>
        <p style={{color:'var(--color-text-light)'}}>공지를 찾을 수 없어요.</p>
        <button className="btn btn-outline btn-sm" style={{marginTop:12}} onClick={()=>navigate('/dashboard')}>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  )

  return (
    <div className="fade-in" style={{maxWidth:680,margin:'0 auto',padding:'20px 0 60px'}}>
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
        <div style={{fontSize:'0.78rem',color:'var(--color-text-light)',marginBottom:24,paddingBottom:16,borderBottom:'1px solid var(--color-border)'}}>
          {new Date(notice.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})} {new Date(notice.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
          {notice.updated_at !== notice.created_at && (
            <span style={{marginLeft:8}}>(수정됨)</span>
          )}
        </div>
        <MarkdownRenderer content={notice.content} style={{fontSize:'0.92rem',lineHeight:1.9}}/>
      </div>
    </div>
  )
}
