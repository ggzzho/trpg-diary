// src/pages/NoticeListPage.js
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { usePagination } from '../hooks/usePagination'
import { Pagination } from '../components/Layout'

const fmtDT = (d) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('ko-KR', { year:'numeric', month:'numeric', day:'numeric' })
    + ' ' + dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
}

export default function NoticeListPage() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const { paged, page, setPage, perPage, setPerPage } = usePagination(notices, 10)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notices').select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setNotices(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <Mi style={{marginRight:8, verticalAlign:'middle'}}>campaign</Mi>공지사항
        </h1>
        <p className="page-subtitle">TRPG Diary의 업데이트 및 공지를 확인해요</p>
      </div>

      {loading
        ? <div className="text-sm text-light" style={{textAlign:'center', padding:40}}>불러오는 중...</div>
        : notices.length === 0
          ? <div className="card" style={{textAlign:'center', padding:48, color:'var(--color-text-light)'}}>
              <Mi style={{fontSize:36, marginBottom:12, opacity:0.3}}>campaign</Mi>
              <p>등록된 공지가 없어요</p>
            </div>
          : <>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {paged.map(n => (
                  <Link key={n.id} to={`/notices/${n.id}`}
                    style={{textDecoration:'none', color:'inherit'}}>
                    <div className="card"
                      style={{padding:'14px 18px', cursor:'pointer', transition:'opacity 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
                      onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        {n.is_popup && (
                          <span className="badge badge-primary" style={{fontSize:'0.62rem', flexShrink:0}}>
                            <Mi size="sm" color="white">notifications</Mi> 공지
                          </span>
                        )}
                        <span style={{flex:1, fontWeight:600, fontSize:'0.9rem',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {n.title}
                        </span>
                        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                          <span style={{fontSize:'0.72rem',color:'var(--color-text-light)',display:'flex',alignItems:'center',gap:3}}>
                            <Mi size="sm" color="light">visibility</Mi>{(n.view_count||0).toLocaleString()}
                          </span>
                          <span style={{fontSize:'0.75rem',color:'var(--color-text-light)'}}>
                            {fmtDT(n.created_at)}
                          </span>
                        </div>
                        <Mi size="sm" color="light">chevron_right</Mi>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Pagination total={notices.length} perPage={perPage} page={page}
                onPage={setPage} onPerPage={setPerPage}/>
            </>
      }
    </div>
  )
}
