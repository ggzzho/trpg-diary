// src/pages/Dashboard.js
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { schedulesApi, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { SCENARIO_ICON } from '../components/Layout'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ logs:0, rulebooks:0, scenarios:0, pairs:0 })
  const [upcoming, setUpcoming] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [l,r,sc,p,s,fav] = await Promise.all([
        playLogsApi.getAll(user.id),
        rulebooksApi.getAll(user.id),
        scenariosApi.getAll(user.id),
        pairsApi.getAll(user.id),
        schedulesApi.getAll(user.id),
        supabase.from('favorites').select('*').eq('user_id',user.id).order('created_at',{ascending:false})
      ])
      setStats({logs:l.data?.length||0,rulebooks:r.data?.length||0,scenarios:sc.data?.length||0,pairs:p.data?.length||0})
      setUpcoming((s.data||[]).filter(x=>x.scheduled_date>=todayStr&&x.status!=='cancelled'&&x.status!=='completed').sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)).slice(0,5))
      setRecentLogs((l.data||[]).slice(0,4))
      setFavorites(fav.data||[])
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
    {label:'다녀온 기록', value:stats.logs, icon:'📖', to:'/logs', unit:'회'},
    {label:'보유 룰북', value:stats.rulebooks, icon:'📚', to:'/rulebooks', unit:'권'},
    {label:'시나리오 목록', value:stats.scenarios, icon:SCENARIO_ICON, to:'/scenarios', unit:'개'},
    {label:'페어 목록', value:stats.pairs, icon:'👥', to:'/pairs', unit:'명'},
  ]

  return (
    <div className="fade-in">
      <div style={{marginBottom:36}}>
        <p style={{color:'var(--color-text-light)',fontSize:'0.85rem',marginBottom:6}}>{greet()}</p>
        <h1 className="text-serif" style={{fontSize:'2rem',color:'var(--color-accent)'}}>{profile?.display_name||profile?.username}님의 다이어리</h1>
        <p style={{color:'var(--color-text-light)',fontSize:'0.85rem',marginTop:8}}>오늘도 좋은 세션 되세요 🎲</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:24}}>
        {STAT_CARDS.map(c=>(
          <Link key={c.label} to={c.to} style={{textDecoration:'none'}}>
            <div className="card" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px'}}>
              <span style={{fontSize:'1.8rem'}}>{c.icon}</span>
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
              <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem'}}>📅 다가오는 일정</h2>
              <div className="text-xs text-light">{format(today,'yyyy년 M월 d일 (EEE)',{locale:ko})}</div>
            </div>
            <Link to="/schedule" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {upcoming.length===0
            ?<p className="text-light text-sm">예정된 일정이 없어요</p>
            :upcoming.map(s=>{
              const isToday = s.scheduled_date===todayStr
              return (
                <div key={s.id} style={{padding:'10px 0',borderBottom:'1px solid var(--color-border)',display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{background:'var(--color-primary)',borderRadius:7,padding:'5px 9px',textAlign:'center',minWidth:40,flexShrink:0,boxShadow:'0 2px 6px var(--color-btn-shadow)'}}>
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
            <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem'}}>📖 최근 기록</h2>
            <Link to="/logs" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {recentLogs.length===0
            ?<p className="text-light text-sm">아직 기록이 없어요</p>
            :recentLogs.map(l=>(
              <div key={l.id} style={{padding:'9px 0',borderBottom:'1px solid var(--color-border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:500,fontSize:'0.88rem'}}>{l.title}</div>
                  <div className="text-xs text-light">{l.played_date&&format(new Date(l.played_date),'yyyy.MM.dd')} · {l.role}</div>
                </div>
                {l.rating>0&&<div className="stars" style={{fontSize:'0.78rem',flexShrink:0}}>{'★'.repeat(l.rating)}{'☆'.repeat(5-l.rating)}</div>}
              </div>
            ))
          }
        </div>
      </div>

      {/* 즐겨찾기 */}
      {favorites.length>0&&(
        <div className="card" style={{marginTop:16}}>
          <h2 className="text-serif" style={{color:'var(--color-accent)',fontSize:'1rem',marginBottom:14}}>⭐ 즐겨찾기</h2>
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
            <div className="text-serif" style={{color:'var(--color-accent)',marginBottom:3,fontSize:'0.95rem'}}>🔗 내 공개 페이지</div>
            <div className="text-sm text-light">{window.location.origin}/u/{profile.username}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);alert('링크가 복사되었어요!')}}>링크 복사</button>
        </div>
      )}
    </div>
  )
}
