// src/pages/PublicProfilePage.js
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProfile, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { GuestbookPage } from './GuestbookPage'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const SCENARIO_STATUS = { unplayed:'미플', played:'PL완료', gm_done:'GM완료', want:'위시' }

function calcDday(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date() - new Date(dateStr)) / (1000*60*60*24))
}

export default function PublicProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('logs')

  useEffect(() => {
    const load = async () => {
      const { data: p, error } = await getProfile(username)
      if (error || !p) { setNotFound(true); setLoading(false); return }
      setProfile(p)

      applyTheme(p.theme_color||'#c8a96e', p.theme_bg_color||'#faf6f0', p.theme_accent||'#8b6f47')
      applyBackground(p.background_image_url||'', p.bg_opacity!==undefined ? p.bg_opacity : 1)

      const today = new Date().toISOString().split('T')[0]
      const [logs, rulebooks, scenarios, pairs, availability, schedules] = await Promise.all([
        playLogsApi.getAll(p.id),
        rulebooksApi.getAll(p.id),
        scenariosApi.getAll(p.id),
        pairsApi.getAll(p.id),
        supabase.from('availability').select('*').eq('user_id',p.id).eq('is_active',true),
        supabase.from('schedules').select('*').eq('user_id',p.id).gte('scheduled_date',today).neq('status','cancelled').order('scheduled_date'),
      ])

      setData({
        logs: logs.data||[], rulebooks: rulebooks.data||[],
        scenarios: scenarios.data||[], pairs: pairs.data||[],
        availability: availability.data||[], schedules: schedules.data||[],
      })
      setLoading(false)
    }
    load()
  }, [username])

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',color:'var(--color-text-light)',fontSize:'0.88rem'}}>불러오는 중...</div>
    </div>
  )

  if (notFound) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'2.5rem',marginBottom:14}}>🗺️</div>
        <h1 style={{fontWeight:700,color:'var(--color-accent)',marginBottom:7,fontSize:'1.3rem'}}>페이지를 찾을 수 없어요</h1>
        <p style={{color:'var(--color-text-light)',fontSize:'0.85rem'}}>@{username} 사용자가 없거나 비공개 상태예요</p>
      </div>
    </div>
  )

  // 프로필 섹션 (신규 방식 우선, 구버전 호환)
  const profileSections = (() => {
    if (profile.profile_sections?.length > 0) return profile.profile_sections
    const legacy = []
    if (profile.play_style) legacy.push({label:'플레이 스타일', value:profile.play_style})
    if (profile.caution) legacy.push({label:'주의 사항', value:profile.caution})
    if (profile.extra_info) legacy.push({label:'기타 사항', value:profile.extra_info})
    return legacy
  })()

  const TABS = [
    {key:'schedules',label:'📅 일정',count:data.schedules?.length},
    {key:'logs',label:'📖 기록',count:data.logs?.length},
    {key:'rulebooks',label:'📚 룰북',count:data.rulebooks?.length},
    {key:'scenarios',label:'🗺️ 시나리오',count:data.scenarios?.length},
    {key:'pairs',label:'👥 페어',count:data.pairs?.length},
    {key:'availability',label:'📋 공수표',count:data.availability?.length},
    {key:'guestbook',label:'💌 방명록'},
  ]

  return (
    <div style={{maxWidth:820, margin:'0 auto', padding:'20px 20px 40px'}}>

      {/* ── 프로필 카드 (X 트위터 스타일) ── */}
      <div className="card" style={{marginBottom:24, padding:0, overflow:'visible', position:'relative'}}>

        {/* 헤더 이미지 - 카드 상단에 radius 유지 */}
        <div style={{
          height: 200,
          background: 'var(--color-nav-active-bg)',
          borderRadius:'var(--radius) var(--radius) 0 0',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {profile.header_image_url
            ? <img src={profile.header_image_url} alt="header" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}} />
            : <div style={{width:'100%',height:'100%',background:`linear-gradient(135deg, var(--color-primary), var(--color-accent))`,opacity:0.3}} />
          }
        </div>

        {/* 프로필 내용 */}
        <div style={{padding:'0 24px 24px', textAlign:'center'}}>
          {/* 아바타 - 헤더 경계에 반쯤 걸치게 (overflow visible 덕분에 안 잘림) */}
          <div style={{display:'flex', justifyContent:'center', marginTop:-44, marginBottom:12}}>
            <div className="user-avatar" style={{
              width:88, height:88, fontSize:'2.2rem',
              border:'4px solid white',
              boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
              background:'var(--color-surface)',
              zIndex: 2,
              position: 'relative'
            }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" /> : (profile.display_name||'?')[0]}
            </div>
          </div>

          <h1 style={{fontSize:'1.5rem',fontWeight:700,color:'var(--color-accent)',letterSpacing:'-0.03em',marginBottom:2}}>
            {profile.display_name||profile.username}
          </h1>
          <p className="text-sm text-light">@{profile.username}</p>

          {/* 통계 */}
          <div className="flex justify-between" style={{marginTop:16,padding:'12px 0',borderTop:'1px solid var(--color-border)',borderBottom:'1px solid var(--color-border)'}}>
            {[{label:'기록',v:data.logs?.length||0},{label:'룰북',v:data.rulebooks?.length||0},{label:'시나리오',v:data.scenarios?.length||0},{label:'페어',v:data.pairs?.length||0}].map(s=>(
              <div key={s.label} style={{textAlign:'center',flex:1}}>
                <div style={{fontSize:'1.3rem',color:'var(--color-accent)',fontWeight:700}}>{s.v}</div>
                <div className="text-xs text-light">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 커스텀 프로필 섹션 */}
          {profileSections.filter(s=>s.value).length > 0 && (
            <div style={{marginTop:16, textAlign:'left', display:'flex', flexDirection:'column', gap:12}}>
              {profileSections.filter(s=>s.value).map((section,i)=>(
                <div key={i}>
                  <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--color-accent)',marginBottom:4}}>{section.label}</div>
                  <p style={{fontSize:'0.84rem',color:'var(--color-text-light)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{section.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 외부 링크 */}
          {profile.external_links?.length > 0 && (
            <div style={{marginTop:14, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center'}}>
              {profile.external_links.map((link,i)=>(
                <a key={i} href={link.url} target="_blank" rel="noreferrer"
                  style={{padding:'4px 12px',borderRadius:100,background:'var(--color-nav-active-bg)',color:'var(--color-accent)',fontSize:'0.76rem',fontWeight:600,textDecoration:'none'}}>
                  🔗 {link.label}
                </a>
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

      {/* ── 일정 ── */}
      {activeTab==='schedules' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.schedules?.length===0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>예정된 일정이 없어요</div>
            : data.schedules?.map(s=>(
              <div key={s.id} className="card card-sm" style={{display:'flex',gap:14,alignItems:'center'}}>
                <div style={{background:'var(--color-primary)',borderRadius:8,padding:'7px 11px',textAlign:'center',minWidth:48,flexShrink:0,boxShadow:'0 2px 8px var(--color-btn-shadow)'}}>
                  <div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.8)'}}>{format(new Date(s.scheduled_date),'M월',{locale:ko})}</div>
                  <div style={{fontSize:'1.2rem',color:'white',fontWeight:700,lineHeight:1}}>{format(new Date(s.scheduled_date),'d')}</div>
                  <div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.8)'}}>{format(new Date(s.scheduled_date),'EEE',{locale:ko})}</div>
                </div>
                <div style={{flex:1}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:'0.88rem'}}>{s.title}</span>
                    {s.is_gm&&<span className="badge badge-primary">GM</span>}
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {s.system_name&&<span>🎲 {s.system_name}</span>}
                    {s.scheduled_time&&<span>🕐 {s.scheduled_time}</span>}
                    {s.location&&<span>🌐 {s.location}</span>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 기록 (가로형 카드) ── */}
      {activeTab==='logs' && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:14}}>
          {data.logs?.length===0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem',gridColumn:'1/-1'}}>아직 기록이 없어요</div>
            : data.logs?.map(l=>(
              <div key={l.id} style={{borderRadius:12,overflow:'hidden',background:'var(--color-surface)',border:'1px solid var(--color-border)',boxShadow:'0 2px 12px var(--color-shadow)',display:'flex',flexDirection:'column'}}>
                {/* 이미지 + 그라데이션 + 태그 - 16:9 */}
                <div style={{position:'relative', paddingTop:'56.25%'}}>
                  <div style={{position:'absolute',inset:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                    {l.session_image_url ? <img src={l.session_image_url} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'3rem',opacity:0.2}}>📖</span>}
                  </div>
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'65%',background:'linear-gradient(to top, var(--color-bg) 0%, rgba(255,255,255,0.6) 55%, transparent 100%)',pointerEvents:'none'}} />
                  <div style={{position:'absolute',bottom:10,left:10,right:10,display:'flex',gap:4,flexWrap:'wrap'}}>
                    {l.series_tag&&<span style={{padding:'2px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:700,background:'rgba(200,169,110,0.2)',color:'#8b6f47',border:'1px solid rgba(200,169,110,0.4)'}}>{l.series_tag}</span>}
                    <span style={{padding:'2px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:700,background: l.role==='GM'?'rgba(155,137,196,0.18)':'rgba(100,149,237,0.15)',color: l.role==='GM'?'#5a3a9c':'#2a5aaa',border:`1px solid ${l.role==='GM'?'rgba(155,137,196,0.4)':'rgba(100,149,237,0.35)'}`}}>{l.role}</span>
                    {l.system_name&&<span style={{padding:'2px 7px',borderRadius:100,fontSize:'0.62rem',fontWeight:700,background:'rgba(156,175,136,0.18)',color:'#4a6a30',border:'1px solid rgba(156,175,136,0.4)'}}>{l.system_name}</span>}
                  </div>
                </div>
                {/* 정보 */}
                <div style={{padding:'10px 12px 12px',flex:1,display:'flex',flexDirection:'column',gap:3}}>
                  <div style={{fontWeight:700,fontSize:'0.88rem',lineHeight:1.3}}>{l.title}</div>
                  {l.together_with&&<div style={{fontSize:'0.7rem',color:'var(--color-text-light)'}}><span style={{fontWeight:600,marginRight:3}}>GM.</span>{l.together_with}</div>}
                  {l.character_name&&<div style={{fontSize:'0.7rem',color:'var(--color-text-light)'}}><span style={{fontWeight:600,marginRight:3}}>PC.</span>{l.character_name}</div>}
                  {l.played_date&&<div style={{fontSize:'0.7rem',color:'var(--color-text-light)'}}><span style={{fontWeight:600,marginRight:3}}>Date.</span>{format(new Date(l.played_date),'yyyy.MM.dd')}</div>}
                  {l.rating>0&&<div className="stars" style={{fontSize:'0.78rem',marginTop:2}}>{'★'.repeat(l.rating)}{'☆'.repeat(5-l.rating)}</div>}
                  {l.scenario_link&&<a href={l.scenario_link} target="_blank" rel="noreferrer" style={{fontSize:'0.7rem',color:'var(--color-primary)',marginTop:2}}>🔗 시나리오 링크</a>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 룰북 (리스트+아이콘) ── */}
      {activeTab==='rulebooks' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {data.rulebooks?.length===0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>룰북이 없어요</div>
            : data.rulebooks?.map(r=>(
              <div key={r.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {r.cover_image_url ? <img src={r.cover_image_url} alt={r.title} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'1.5rem',opacity:0.4}}>📚</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:3}}>{r.title}</div>
                  <div className="text-xs text-light flex gap-10">
                    {r.system_name&&<span>🎲 {r.system_name}</span>}
                    {r.publisher&&<span>🏢 {r.publisher}</span>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 시나리오 (리스트) ── */}
      {activeTab==='scenarios' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {data.scenarios?.length===0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>시나리오가 없어요</div>
            : data.scenarios?.map(s=>(
              <div key={s.id} className="card card-sm" style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',flexShrink:0,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {s.cover_image_url ? <img src={s.cover_image_url} alt={s.title} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'1.5rem',opacity:0.4}}>🗺️</span>}
                </div>
                <div style={{flex:1}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{fontWeight:700,fontSize:'0.9rem'}}>{s.title}</span>
                    <span className="badge badge-gray">{SCENARIO_STATUS[s.status]}</span>
                  </div>
                  <div className="text-xs text-light flex gap-10">
                    {s.system_name&&<span>🎲 {s.system_name}</span>}
                    {s.player_count&&<span>👥 {s.player_count}</span>}
                    {s.estimated_time&&<span>⏱️ {s.estimated_time}</span>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 페어 (큰 섬네일 + D+day + 관계태그) ── */}
      {activeTab==='pairs' && (
        <div className="grid-auto">
          {data.pairs?.length===0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>페어 목록이 없어요</div>
            : data.pairs?.map(p=>{
              const dday = calcDday(p.first_met_date)
              return (
                <div key={p.id} className="card" style={{padding:0,overflow:'hidden'}}>
                  <div style={{height:160,background:'var(--color-nav-active-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                    {p.pair_image_url ? <img src={p.pair_image_url} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'4rem',opacity:0.25}}>👤</span>}
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
                    {p.relations?.length>0&&(
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                        {p.relations.map(r=><span key={r} className="badge badge-primary">{r}</span>)}
                      </div>
                    )}
                    {p.first_met_date&&<div className="text-xs text-light">📅 {p.first_met_date} 첫 만남</div>}
                    {p.memo&&<p className="text-xs text-light" style={{marginTop:8,borderTop:'1px solid var(--color-border)',paddingTop:8}}>{p.memo}</p>}
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── 공수표 ── */}
      {activeTab==='availability' && (
        <div className="grid-auto">
          {data.availability?.length===0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>활성화된 공수표가 없어요</div>
            : data.availability?.map(a=>(
              <div key={a.id} className="card">
                <div className="flex gap-8" style={{marginBottom:8}}>
                  <span className="badge badge-green">활성</span>
                  <span className="badge badge-primary">{a.role}</span>
                </div>
                <h3 style={{fontWeight:600,marginBottom:7,fontSize:'0.88rem'}}>{a.title}</h3>
                <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:3}}>
                  {a.system_name&&<span>🎲 {a.system_name}</span>}
                  {a.preferred_days?.length>0&&<span>📅 {a.preferred_days.join(', ')}요일</span>}
                  {a.preferred_time&&<span>🕐 {a.preferred_time}</span>}
                  {a.together_with&&<span>👥 {a.together_with}</span>}
                </div>
                {a.description&&<p style={{fontSize:'0.82rem',color:'var(--color-text-light)',marginTop:7}}>{a.description}</p>}
                {a.scenario_link&&<a href={a.scenario_link} target="_blank" rel="noreferrer" style={{fontSize:'0.78rem',color:'var(--color-primary)',display:'block',marginTop:7}}>🔗 시나리오 링크</a>}
              </div>
            ))
          }
        </div>
      )}

      {/* ── 방명록 ── */}
      {activeTab==='guestbook' && <GuestbookPage ownerId={profile.id} />}
    </div>
  )
}
