// src/pages/PublicProfilePage.js
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProfile, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { GuestbookPage } from './GuestbookPage'
import { LogDetailContent } from './PlayLogPage'
import { FOOTER_TEXT, Modal, StarRating } from '../components/Layout'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'

const SCENARIO_STATUS = { unplayed:'미플', played:'PL완료', gm_done:'GM완료', want:'위시' }

function calcDday(d) {
  if (!d) return null
  return Math.floor((new Date() - new Date(d)) / 86400000)
}

const TC = {
  series:{bg:'rgba(200,169,110,0.18)',color:'#8b6f47',border:'rgba(200,169,110,0.5)'},
  role_PL:{bg:'rgba(100,149,237,0.15)',color:'#2a5aaa',border:'rgba(100,149,237,0.4)'},
  role_GM:{bg:'rgba(155,137,196,0.15)',color:'#5a3a9c',border:'rgba(155,137,196,0.4)'},
  rule:{bg:'rgba(156,175,136,0.18)',color:'#4a6a30',border:'rgba(156,175,136,0.5)'},
}
function Chip({ type, label }) {
  const c = type==='series'?TC.series : type==='role'?(label==='GM'?TC.role_GM:TC.role_PL) : TC.rule
  return <span style={{display:'inline-flex',padding:'2px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:700,background:c.bg,color:c.color,border:`1px solid ${c.border}`,whiteSpace:'nowrap'}}>{label}</span>
}

function getEmbedUrl(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&loop=1&playlist=${m[1]}&mute=0` : null
}

// ── 미니 캘린더 ──
function PublicCalendar({ schedules }) {
  const [cal, setCal] = useState(new Date())
  if (!schedules.length) return (
    <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>예정된 일정이 없어요</div>
  )
  const s0 = startOfWeek(startOfMonth(cal),{weekStartsOn:0})
  const e0 = endOfWeek(endOfMonth(cal),{weekStartsOn:0})
  const rows=[]; let day=s0
  while(day<=e0){
    const wk=[]
    for(let i=0;i<7;i++){
      const d=new Date(day), ds=format(d,'yyyy-MM-dd')
      const di=schedules.filter(s=>s.scheduled_date===ds)
      wk.push(
        <div key={ds} style={{height:70,border:'1px solid var(--color-border)',borderRadius:4,padding:4,background:isToday(d)?'var(--color-nav-active-bg)':'var(--color-surface)',opacity:!isSameMonth(d,cal)?0.3:1,overflow:'hidden'}}>
          <div style={{fontSize:'0.68rem',fontWeight:600,color:isToday(d)?'var(--color-accent)':'var(--color-text)',marginBottom:2}}>{format(d,'d')}</div>
          {di.slice(0,2).map(ev=>(
            <div key={ev.id} style={{fontSize:'0.58rem',padding:'1px 3px',borderRadius:2,marginBottom:1,background:ev.is_gm?'var(--color-accent)':'var(--color-primary)',color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {ev.scheduled_time&&<span style={{opacity:0.85,marginRight:2}}>{ev.scheduled_time.slice(0,5)}</span>}
              {ev.title}
            </div>
          ))}
          {di.length>2&&<div style={{fontSize:'0.52rem',color:'var(--color-text-light)'}}>+{di.length-2}</div>}
        </div>
      )
      day=addDays(day,1)
    }
    rows.push(<React.Fragment key={day.toString()}>{wk}</React.Fragment>)
  }
  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{marginBottom:10}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCal(subMonths(cal,1))}>‹</button>
        <span style={{fontWeight:700,fontSize:'0.95rem',color:'var(--color-accent)'}}>{format(cal,'yyyy년 M월',{locale:ko})}</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCal(addMonths(cal,1))}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:3}}>
        {['일','월','화','수','목','금','토'].map((d,i)=>(
          <div key={d} style={{textAlign:'center',fontSize:'0.65rem',fontWeight:600,color:i===0?'#e57373':i===6?'#6b8cba':'var(--color-text-light)',padding:'3px 0'}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>{rows}</div>
    </div>
  )
}

export default function PublicProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('schedules') // 기본값: 일정
  const [isFav, setIsFav] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [bgmOn, setBgmOn] = useState(false)

  useEffect(() => {
    const load = async () => {
      const {data:p,error} = await getProfile(username)
      if (error||!p) { setNotFound(true); setLoading(false); return }
      setProfile(p)
      applyTheme(p.theme_color||'#c8a96e', p.theme_bg_color||'#faf6f0', p.theme_accent||'#8b6f47')
      applyBackground(p.background_image_url||'', p.bg_opacity!==undefined?p.bg_opacity:1)

      const today = new Date().toISOString().split('T')[0]
      const safe = async fn => { try { const r=await fn; return r.data||[] } catch { return [] } }
      const [logs,rulebooks,scenarios,pairs,avail,scheds] = await Promise.all([
        safe(playLogsApi.getAll(p.id)),
        safe(rulebooksApi.getAll(p.id)),
        safe(scenariosApi.getAll(p.id)),
        safe(pairsApi.getAll(p.id)),
        safe(supabase.from('availability').select('*').eq('user_id',p.id).eq('is_active',true).then(r=>r)),
        safe(supabase.from('schedules').select('*').eq('user_id',p.id).gte('scheduled_date',today).neq('status','cancelled').neq('status','completed').order('scheduled_date').then(r=>r)),
      ])
      setData({logs,rulebooks,scenarios,pairs,availability:avail,schedules:scheds})
      setLoading(false)

      if (user) {
        const {data:fav} = await supabase.from('favorites').select('id').eq('user_id',user.id).eq('target_username',username).single()
        setIsFav(!!fav)
      }
    }
    load()
  }, [username, user])

  const toggleFav = async () => {
    if (!user) { alert('로그인 후 이용해주세요!'); return }
    setFavLoading(true)
    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id',user.id).eq('target_username',username)
      setIsFav(false)
    } else {
      await supabase.from('favorites').insert({user_id:user.id, target_username:username, target_display_name:profile?.display_name||username, target_avatar_url:profile?.avatar_url||null})
      setIsFav(true)
    }
    setFavLoading(false)
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'var(--color-text-light)',fontSize:'0.88rem'}}>불러오는 중...</div></div>
  if (notFound) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:'2.5rem',marginBottom:14}}>📗</div><h1 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:7,fontSize:'1.3rem'}}>페이지를 찾을 수 없어요</h1><p style={{color:'var(--color-text-light)',fontSize:'0.85rem'}}>@{username} 사용자가 없거나 비공개예요</p></div>
    </div>
  )

  const isMyPage = user?.id === profile?.id
  const bgmUrl = getEmbedUrl(profile.bgm_url)
  const sections = (() => {
    if (profile.profile_sections?.length>0) return profile.profile_sections
    const l=[]
    if(profile.play_style) l.push({label:'플레이 스타일',value:profile.play_style})
    if(profile.caution) l.push({label:'주의 사항',value:profile.caution})
    if(profile.extra_info) l.push({label:'기타 사항',value:profile.extra_info})
    return l
  })()

  const TABS = [
    {key:'schedules',label:'📅 일정',count:data.schedules?.length},
    {key:'logs',label:'📖 기록',count:data.logs?.length},
    {key:'rulebooks',label:'📚 룰북',count:data.rulebooks?.length},
    {key:'scenarios',label:'📗 시나리오',count:data.scenarios?.length},
    {key:'pairs',label:'👥 페어',count:data.pairs?.length},
    {key:'availability',label:'📋 공수표',count:data.availability?.length},
    {key:'guestbook',label:'💌 방명록'},
  ]

  return (
    <div style={{maxWidth:860,margin:'0 auto',padding:'20px 20px 0'}}>
      {/* BGM */}
      {bgmOn&&bgmUrl&&<iframe src={bgmUrl} style={{display:'none'}} allow="autoplay" title="bgm"/>}

      {/* 프로필 카드 */}
      <div className="card" style={{marginBottom:24,overflow:'visible',padding:0}}>
        <div style={{height:215,background:'var(--color-nav-active-bg)',borderRadius:'var(--radius) var(--radius) 0 0',overflow:'hidden'}}>
          {profile.header_image_url
            ?<img src={profile.header_image_url} alt="header" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
            :<div style={{width:'100%',height:'100%',background:`linear-gradient(135deg,var(--color-primary),var(--color-accent))`,opacity:0.3}}/>
          }
        </div>
        <div style={{padding:'0 24px 24px',textAlign:'center'}}>
          <div style={{display:'flex',justifyContent:'center',marginTop:-52,marginBottom:12}}>
            <div className="user-avatar" style={{width:100,height:100,fontSize:'2.4rem',border:'4px solid white',boxShadow:'0 4px 20px rgba(0,0,0,0.18)',background:'var(--color-surface)',zIndex:2,position:'relative'}}>
              {profile.avatar_url?<img src={profile.avatar_url} alt="avatar"/>:(profile.display_name||'?')[0]}
            </div>
          </div>
          {/* 즐겨찾기 + BGM */}
          <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:10}}>
            {!isMyPage&&(
              <button className={`btn btn-sm ${isFav?'btn-primary':'btn-outline'}`} onClick={toggleFav} disabled={favLoading}>
                {isFav?'⭐ 즐겨찾기 중':'☆ 즐겨찾기'}
              </button>
            )}
            {bgmUrl&&(
              <button className={`btn btn-sm ${bgmOn?'btn-primary':'btn-outline'}`} onClick={()=>setBgmOn(v=>!v)}>
                {bgmOn?'🎵 BGM 끄기':'🎵 BGM 켜기'}
              </button>
            )}
          </div>
          <h1 style={{fontSize:'1.5rem',fontWeight:700,color:'var(--color-accent)',letterSpacing:'-0.03em',marginBottom:2}}>{profile.display_name||profile.username}</h1>
          <p className="text-sm text-light">@{profile.username}</p>
          <div className="flex justify-between" style={{marginTop:16,padding:'12px 0',borderTop:'1px solid var(--color-border)',borderBottom:'1px solid var(--color-border)'}}>
            {[{label:'기록',v:data.logs?.length||0},{label:'룰북',v:data.rulebooks?.length||0},{label:'시나리오',v:data.scenarios?.length||0},{label:'페어',v:data.pairs?.length||0}].map(s=>(
              <div key={s.label} style={{textAlign:'center',flex:1}}>
                <div style={{fontSize:'1.3rem',color:'var(--color-accent)',fontWeight:700}}>{s.v}</div>
                <div className="text-xs text-light">{s.label}</div>
              </div>
            ))}
          </div>
          {sections.filter(s=>s.value).length>0&&(
            <div style={{marginTop:16,textAlign:'left',display:'flex',flexDirection:'column',gap:12}}>
              {sections.filter(s=>s.value).map((sec,i)=>(
                <div key={i}>
                  <div style={{fontSize:'0.88rem',fontWeight:700,color:'var(--color-accent)',marginBottom:4}}>{sec.label}</div>
                  <p style={{fontSize:'0.92rem',color:'var(--color-text-light)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{sec.value}</p>
                </div>
              ))}
            </div>
          )}
          {profile.external_links?.length>0&&(
            <div style={{marginTop:14,display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
              {profile.external_links.map((link,i)=>(
                <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{padding:'4px 12px',borderRadius:100,background:'var(--color-nav-active-bg)',color:'var(--color-accent)',fontSize:'0.76rem',fontWeight:600,textDecoration:'none'}}>🔗 {link.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-8" style={{marginBottom:20,flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t.key} className={`btn btn-sm ${activeTab===t.key?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab(t.key)}>
            {t.label}{t.count!==undefined?` (${t.count})`:''}
          </button>
        ))}
      </div>

      {/* ── 일정 (캘린더) ── */}
      {activeTab==='schedules'&&<PublicCalendar schedules={data.schedules||[]}/>}

      {/* ── 기록 (카드 + 팝업) ── */}
      {activeTab==='logs'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(238px,1fr))',gap:13}}>
            {!data.logs?.length
              ?<div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem',gridColumn:'1/-1'}}>아직 기록이 없어요</div>
              :data.logs.map(l=>(
                <div key={l.id}
                  style={{borderRadius:12,overflow:'hidden',background:'var(--color-surface)',border:'1px solid var(--color-border)',boxShadow:'0 2px 12px var(--color-shadow)',display:'flex',flexDirection:'column',cursor:'pointer',transition:'transform 0.15s,box-shadow 0.15s'}}
                  onClick={()=>setSelectedLog(l)}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
                >
                  <div style={{position:'relative',paddingTop:'56.25%'}}>
                    <div style={{position:'absolute',inset:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                      {l.session_image_url?<img src={l.session_image_url} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'2.5rem',opacity:0.2}}>📖</span>}
                    </div>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,height:'65%',background:'linear-gradient(to top,var(--color-bg) 0%,rgba(255,255,255,0.6) 55%,transparent 100%)',pointerEvents:'none'}}/>
                    <div style={{position:'absolute',bottom:10,left:10,right:10,display:'flex',gap:4,flexWrap:'wrap'}}>
                      {l.series_tag&&<Chip type="series" label={l.series_tag}/>}
                      <Chip type="role" label={l.role}/>
                      {l.system_name&&<Chip type="rule" label={l.system_name}/>}
                    </div>
                  </div>
                  <div style={{padding:'10px 12px 12px',flex:1,display:'flex',flexDirection:'column'}}>
                    <div style={{fontWeight:700,fontSize:'0.88rem',lineHeight:1.3,marginBottom:8}}>{l.title}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      {l.played_date&&<div style={{fontSize:'0.63rem',color:'var(--color-text-light)'}}><span style={{fontWeight:600,marginRight:4}}>Date.</span>{format(new Date(l.played_date),'yyyy.MM.dd')}</div>}
                      {(l.together_with||l.character_name)&&(
                        <div style={{fontSize:'0.63rem',color:'var(--color-text-light)',display:'flex',gap:12}}>
                          {l.together_with&&<span><span style={{fontWeight:600,marginRight:4}}>GM.</span>{l.together_with}</span>}
                          {l.character_name&&<span><span style={{fontWeight:600,marginRight:4}}>PL.</span>{l.character_name}</span>}
                        </div>
                      )}
                    </div>
                    {l.rating>0&&<div className="stars" style={{fontSize:'0.72rem',marginTop:6}}>{'★'.repeat(l.rating)}{'☆'.repeat(5-l.rating)}</div>}
                    {l.spoiler_content&&<div style={{fontSize:'0.62rem',color:'#e57373',marginTop:4}}>⚠️ 스포일러 포함</div>}
                  </div>
                </div>
              ))
            }
          </div>
          <Modal isOpen={!!selectedLog} onClose={()=>setSelectedLog(null)} title={selectedLog?.title}
            footer={<button className="btn btn-outline btn-sm" onClick={()=>setSelectedLog(null)}>닫기</button>}
          >
            {selectedLog&&<LogDetailContent detail={selectedLog}/>}
          </Modal>
        </>
      )}

      {/* ── 룰북 ── */}
      {activeTab==='rulebooks'&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {!data.rulebooks?.length
            ?<div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>룰북이 없어요</div>
            :data.rulebooks.map(r=>(
              <div key={r.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {r.cover_image_url?<img src={r.cover_image_url} alt={r.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.5rem',opacity:0.4}}>📚</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:4}}>{r.title}</div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:r.tags?.length>0?4:0}}>
                    {r.system_name&&<span className="text-xs text-light">🎲 {r.system_name}</span>}
                    {r.format&&<span className="badge badge-primary" style={{fontSize:'0.62rem'}}>{r.format==='physical'?'실물':r.format==='digital'?'전자':'실물+전자'}</span>}
                  </div>
                  {r.tags?.length>0&&(
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {r.tags.map(t=><span key={t} style={{padding:'1px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:600,background:'var(--color-nav-active-bg)',color:'var(--color-accent)',border:'1px solid var(--color-border)'}}>{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 시나리오 ── */}
      {activeTab==='scenarios'&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {!data.scenarios?.length
            ?<div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>시나리오가 없어요</div>
            :data.scenarios.map(s=>(
              <div key={s.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {s.cover_image_url?<img src={s.cover_image_url} alt={s.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'1.5rem',opacity:0.4}}>📗</span>}
                </div>
                <div style={{flex:1}}>
                  <div className="flex items-center gap-8" style={{marginBottom:5}}>
                    <span style={{fontWeight:700,fontSize:'0.9rem'}}>{s.title}</span>
                    <span className="badge badge-gray">{SCENARIO_STATUS[s.status]}</span>
                  </div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {s.system_name&&<span className="text-xs text-light">🎲 {s.system_name}</span>}
                    {s.author&&<span className="text-xs text-light">✏️ {s.author}</span>}
                    {s.player_count&&<span className="text-xs text-light">👥 {s.player_count}</span>}
                  </div>
                  {s.scenario_url&&<a href={s.scenario_url} target="_blank" rel="noreferrer" style={{fontSize:'0.7rem',color:'var(--color-primary)',marginTop:3,display:'block'}}>🔗 시나리오 링크</a>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 페어 ── */}
      {activeTab==='pairs'&&(
        <div className="grid-auto">
          {!data.pairs?.length
            ?<div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>페어 목록이 없어요</div>
            :data.pairs.map(p=>{
              const dday=calcDday(p.first_met_date)
              return (
                <div key={p.id} className="card" style={{padding:0,overflow:'hidden'}}>
                  <div style={{height:160,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                    {p.pair_image_url?<img src={p.pair_image_url} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'4rem',opacity:0.25}}>👤</span>}
                    {dday!==null&&(
                      <div style={{position:'absolute',top:10,right:10,background:'var(--color-primary)',color:'white',borderRadius:8,padding:'4px 10px',textAlign:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
                        <div style={{fontSize:'0.6rem',opacity:0.85}}>함께한 지</div>
                        <div style={{fontSize:'1.1rem',fontWeight:700,lineHeight:1.2}}>D+{dday}</div>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'12px 14px'}}>
                    <div style={{fontWeight:700,fontSize:'1rem',marginBottom:4}}>{p.name}</div>
                    {p.nickname&&<div className="text-xs text-light" style={{marginBottom:6}}>페어 캐릭터: {p.nickname}</div>}
                    {p.relations?.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>{p.relations.map(r=><span key={r} className="badge badge-primary">{r}</span>)}</div>}
                    {p.first_met_date&&<div className="text-xs text-light">📅 {p.first_met_date} 첫 만남</div>}
                    {p.memo&&<p className="text-xs text-light" style={{marginTop:8,borderTop:'1px solid var(--color-border)',paddingTop:8}}>{p.memo}</p>}
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── 공수표 (리스트형) ── */}
      {activeTab==='availability'&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {!data.availability?.length
            ?<div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>활성화된 공수표가 없어요</div>
            :data.availability.map(a=>(
              <div key={a.id} className="card card-sm">
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div className="flex gap-8" style={{flexShrink:0,paddingTop:2}}>
                    <span className="badge badge-green">활성</span>
                    <span className="badge badge-primary">{a.role}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:'0.9rem',marginBottom:4}}>{a.title}</div>
                    <div className="text-xs text-light flex gap-12" style={{marginBottom:a.description||a.together_with?5:0}}>
                      {a.system_name&&<span>🎲 {a.system_name}</span>}
                      {a.together_with&&<span>👤 {a.together_with}</span>}
                    </div>
                    {a.description&&<p style={{fontSize:'0.82rem',color:'var(--color-text-light)'}}>{a.description}</p>}
                    {a.scenario_link&&<a href={a.scenario_link} target="_blank" rel="noreferrer" style={{fontSize:'0.78rem',color:'var(--color-primary)',display:'block',marginTop:5}}>🔗 시나리오 링크</a>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 방명록 (내 페이지 남기기 포함) ── */}
      {activeTab==='guestbook'&&<GuestbookPage ownerId={profile.id}/>}

      {/* 푸터 */}
      <footer style={{marginTop:60,paddingTop:20,paddingBottom:20,borderTop:'1px solid var(--color-border)',textAlign:'center',color:'var(--color-text-light)',fontSize:'0.72rem'}}>
        {FOOTER_TEXT}
      </footer>
    </div>
  )
}
