// src/pages/Dashboard.js
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { schedulesApi, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MarkdownRenderer } from './AdminNoticePage'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ logs:0, rulebooks:0, scenarios:0, pairs:0 })
  const [upcoming, setUpcoming] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [notices, setNotices] = useState([])
  const [popupNotice, setPopupNotice] = useState(null)
  const [noticeModal, setNoticeModal] = useState(null)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [l,r,sc,p,s,fav,noticeRes] = await Promise.all([
        playLogsApi.getAll(user.id),
        rulebooksApi.getAll(user.id),
        scenariosApi.getAll(user.id),
        pairsApi.getAll(user.id),
        schedulesApi.getAll(user.id),
        supabase.from('favorites').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
        supabase.from('notices').select('*').eq('is_active',true).order('created_at',{ascending:false})
      ])
      setStats({logs:l.data?.length||0,rulebooks:r.data?.length||0,scenarios:sc.data?.length||0,pairs:p.data?.length||0})
      setUpcoming((s.data||[]).filter(x=>x.entry_type!=='blocked'&&x.scheduled_date>=todayStr&&x.status!=='cancelled'&&x.status!=='completed').sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)).slice(0,5))
      setRecentLogs((l.data||[]).slice(0,4))
      setFavorites(fav.data||[])
      const activeNotices = noticeRes.data || []
      setNotices(activeNotices)
      // 팝업: 오늘 닫지 않은 가장 최신 팝업 공지
      const popups = activeNotices.filter(n => n.is_popup)
      if (popups.length > 0) {
        const latest = popups[0]
        const dismissedKey = `notice_dismissed_${latest.id}_${todayStr}`
        if (!localStorage.getItem(dismissedKey)) {
          setPopupNotice(latest)
        }
      }
      setLoading(false)
    }
    load()
  }, [user])

  const greet = () => {
    const h = today.getHours()
    if (h<6) return '밤이 깊었네요 🌙'
    if (h<12) return '좋은 아침이에요 ☀️'
    if (h<18) return '즐거운 오후예요 ✨'
    return '편안한 저녁이에요 🕯️'
  }

  const STAT_CARDS = [
    {label:'다녀온 기록', value:stats.logs, icon:'auto_stories', to:'/logs', unit:'회'},
    {label:'보유 룰북', value:stats.rulebooks, icon:'menu_book', to:'/rulebooks', unit:'권'},
    {label:'시나리오 목록', value:stats.scenarios, icon:'description', to:'/scenarios', unit:'개'},
    {label:'페어 목록', value:stats.pairs, icon:'people', to:'/pairs', unit:'명'},
  ]

  // 오늘 세션 있는지 확인
  const hasTodaySession = upcoming.some(s => s.scheduled_date === todayStr)

  return (
    <div className="fade-in">
      <div style={{marginBottom:36}}>
        <p style={{color:'var(--color-text-light)',fontSize:'0.85rem',marginBottom:6}}>{greet()}</p>
        <h1 className="text-serif" style={{fontSize:'2rem',color:'var(--color-accent)'}}>{profile?.display_name||profile?.username}님의 다이어리</h1>
      </div>

      {/* 오늘 세션 알림 배너 */}
      {hasTodaySession && (
        <div style={{
          marginBottom:20,
          padding:'13px 18px',
          borderRadius:12,
          background:'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          color:'white',
          display:'flex',
          alignItems:'center',
          gap:10,
          boxShadow:'0 4px 16px var(--color-btn-shadow)',
          animation:'fadeIn 0.4s ease'
        }}>
          <span style={{fontSize:'1.4rem'}}>🎲</span>
          <div>
            <div style={{fontWeight:700,fontSize:'0.95rem'}}>오늘은 세션이 있는 날이에요!</div>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:24}}>
        {STAT_CARDS.map(c=>(
          <Link key={c.label} to={c.to} style={{textDecoration:'none'}}>
            <div className="card" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px'}}>
              <Mi size="lg" style={{fontSize:28}}>{c.icon}</Mi>
              <div>
                <div className="text-serif" style={{fontSize:'1.6rem',color:'var(--color-accent)',fontWeight:700,lineHeight:1}}>
                  {loading?'—':c.value}<span style={{fontSize:'0.8rem',marginLeft:3}}>{c.unit}</span>
                </div>
                <div className="text-sm text-light">{c.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:16}}>
        {/* 다가오는 일정 */}
        <div className="card">
          <div className="flex justify-between items-center" style={{marginBottom:16}}>
            <div>
              <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem'}}><Mi style={{marginRight:6}}>calendar_month</Mi>다가오는 일정</h2>
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                {/* Today 아이콘 배지 */}
                <span style={{
                  display:'inline-flex',alignItems:'center',gap:3,
                  padding:'2px 7px',borderRadius:100,
                  background:'var(--color-primary)',color:'white',
                  fontSize:'0.62rem',fontWeight:700,letterSpacing:'0.03em',
                  boxShadow:'0 1px 4px var(--color-btn-shadow)'
                }}>
                  <Mi size="sm" color="white" style={{fontSize:'0.7rem'}}>today</Mi>
                  Today
                </span>
                <div className="text-xs text-light">{format(today,'yyyy년 M월 d일 (EEE)',{locale:ko})}</div>
              </div>
            </div>
            <Link to="/schedule" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {upcoming.length===0
            ?<p className="text-light text-sm">예정된 일정이 없어요</p>
            :upcoming.map(s=>{
              const isToday = s.scheduled_date===todayStr
              return (
                <div key={s.id} style={{padding:'10px 0',borderBottom:'1px solid var(--color-border)',display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{background: isToday ? 'var(--color-accent)' : 'var(--color-primary)',borderRadius:7,padding:'5px 9px',textAlign:'center',minWidth:40,flexShrink:0,boxShadow:'0 2px 6px var(--color-btn-shadow)'}}>
                    <div style={{fontSize:'0.6rem',color:'rgba(255,255,255,0.8)'}}>{format(new Date(s.scheduled_date),'M월',{locale:ko})}</div>
                    <div style={{fontSize:'1.1rem',color:'white',fontWeight:700,lineHeight:1}}>{format(new Date(s.scheduled_date),'d')}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      {isToday&&<span style={{fontSize:'0.62rem',fontWeight:700,padding:'1px 6px',borderRadius:100,background:'var(--color-accent)',color:'white'}}>Today</span>}
                      <span style={{fontWeight:500,fontSize:'0.88rem'}}>{s.title}</span>
                    </div>
                    <div className="text-xs text-light">
                      {s.system_name&&`${s.system_name} · `}{s.is_gm?'GM':'PL'}
                      {s.scheduled_time&&` · ${s.scheduled_time.slice(0,5)}`}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* 최근 기록 */}
        <div className="card">
          <div className="flex justify-between items-center" style={{marginBottom:16}}>
            <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem'}}><Mi style={{marginRight:6}}>auto_stories</Mi>최근 기록</h2>
            <Link to="/logs" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {recentLogs.length===0
            ?<p className="text-light text-sm">아직 기록이 없어요</p>
            :recentLogs.map(l=>(
              <div key={l.id} style={{padding:'10px 0',borderBottom:'1px solid var(--color-border)'}}>
                <div style={{fontWeight:600,fontSize:'0.88rem',marginBottom:4}}>{l.title}</div>
                <div className="text-xs text-light" style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  <span>{l.is_gm?'GM':'PL'}</span>
                  {l.system_name&&<><span style={{opacity:0.4}}>·</span><span>{l.system_name}</span></>}
                  {l.npc&&<><span style={{opacity:0.4}}>·</span><span>{l.npc}</span></>}
                  {(l.start_date||l.played_date)&&<><span style={{opacity:0.4}}>·</span>
                    <span>
                      {l.start_date&&format(new Date(l.start_date),'yyyy.MM.dd')}
                      {l.start_date&&l.played_date&&' ~ '}
                      {l.played_date&&format(new Date(l.played_date),'yyyy.MM.dd')}
                    </span>
                  </>}
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* 즐겨찾기 */}
      {favorites.length>0&&(
        <div className="card" style={{marginTop:16}}>
          <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem',marginBottom:14}}>즐겨찾기</h2>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {favorites.map(f=>(
              <a key={f.id} href={`/u/${f.target_username}`} target="_blank" rel="noreferrer"
                style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:100,background:'var(--color-nav-active-bg)',border:'1px solid var(--color-border)',textDecoration:'none',color:'var(--color-text)'}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72rem',color:'white',fontWeight:700,flexShrink:0,overflow:'hidden'}}>
                  {f.target_avatar_url?<img src={f.target_avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(f.target_display_name||'?')[0]}
                </div>
                <span style={{fontSize:'0.82rem',fontWeight:500}}>{f.target_display_name||f.target_username}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {profile&&(
        <div className="card" style={{marginTop:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div className="text-serif" style={{color:'var(--color-accent)',marginBottom:3,fontSize:'0.95rem'}}><Mi style={{marginRight:6}}>open_in_new</Mi>내 공개 페이지</div>
            <div className="text-sm text-light">https://trpg-diary.co.kr/u/{profile.username}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={()=>{navigator.clipboard.writeText(`https://trpg-diary.co.kr/u/${profile.username}`);alert('링크가 복사되었어요!')}}>링크 복사</button>
        </div>
      )}

      {/* ── 공지사항 섹션 ── */}
      {notices.length > 0 && (
        <div className="card" style={{marginTop:16}}>
          <div className="flex justify-between items-center" style={{marginBottom:12}}>
            <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem'}}>
              <Mi style={{marginRight:6}}>campaign</Mi>공지사항
            </h2>
            <Link to="/notices" style={{fontSize:'0.78rem',color:'var(--color-text-light)',textDecoration:'none',display:'flex',alignItems:'center',gap:2}}>
              전체보기 <Mi size="sm" color="light">chevron_right</Mi>
            </Link>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {notices.slice(0,5).map(n => (
              <div key={n.id}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,
                  background:'var(--color-nav-active-bg)',cursor:'pointer',transition:'opacity 0.15s'}}
                onClick={()=>setNoticeModal(n)}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                {n.is_popup && <Mi size="sm" color="accent">notifications</Mi>}
                <span style={{flex:1,fontSize:'0.88rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {n.title}
                </span>
                <span style={{fontSize:'0.72rem',color:'var(--color-text-light)',flexShrink:0}}>
                  {new Date(n.created_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})} {new Date(n.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
                </span>
                <Mi size="sm" color="light">chevron_right</Mi>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 공지 상세 모달 ── */}
      {noticeModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>e.target===e.currentTarget&&setNoticeModal(null)}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:28,width:'100%',maxWidth:520,maxHeight:'80vh',overflowY:'auto',border:'1px solid var(--color-border)'}}>
            <div className="flex justify-between items-center" style={{marginBottom:16}}>
              <h3 style={{fontWeight:700,fontSize:'1rem',color:'var(--color-accent)'}}>{noticeModal.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={()=>setNoticeModal(null)}>
                <Mi size="sm">close</Mi>
              </button>
            </div>
            <div style={{fontSize:'0.72rem',color:'var(--color-text-light)',marginBottom:14}}>
              {new Date(noticeModal.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})} {new Date(noticeModal.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
            </div>
            <MarkdownRenderer content={noticeModal.content}/>
            <div style={{marginTop:20,paddingTop:14,borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <Link to={`/notices/${noticeModal.id}`} className="btn btn-outline btn-sm"
                onClick={()=>setNoticeModal(null)}>
                <Mi size="sm">open_in_new</Mi> 게시글 보기
              </Link>
              <button className="btn btn-primary btn-sm" onClick={()=>setNoticeModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 팝업 공지 ── */}
      {popupNotice && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:28,width:'100%',maxWidth:480,maxHeight:'80vh',overflowY:'auto',border:'1px solid var(--color-border)',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <Mi color="accent">campaign</Mi>
              <h3 style={{fontWeight:700,fontSize:'1rem',color:'var(--color-accent)',flex:1}}>{popupNotice.title}</h3>
            </div>
            <MarkdownRenderer content={popupNotice.content} style={{marginBottom:20}}/>
            <div className="flex justify-between items-center" style={{paddingTop:14,borderTop:'1px solid var(--color-border)'}}>
              <button className="btn btn-ghost btn-sm" style={{fontSize:'0.78rem',color:'var(--color-text-light)'}}
                onClick={()=>{
                  localStorage.setItem(`notice_dismissed_${popupNotice.id}_${todayStr}`, '1')
                  setPopupNotice(null)
                }}>
                오늘 하루 안 보기
              </button>
              <button className="btn btn-primary btn-sm" onClick={()=>setPopupNotice(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
