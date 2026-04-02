// src/pages/PublicProfilePage.js
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProfile, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GuestbookPage } from './GuestbookPage'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { StarRating } from '../components/Layout'

const SCENARIO_STATUS = { unplayed:'미플', played:'PL완료', gm_done:'GM완료', want:'위시' }
const DIFF_MAP = { beginner:'입문', intermediate:'중급', advanced:'고급', expert:'전문가' }
const SCHEDULE_STATUS = { planned:'예정', confirmed:'확정', completed:'완료', cancelled:'취소' }

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

      // 테마 적용
      const root = document.documentElement
      root.style.setProperty('--color-primary', p.theme_color || '#c8a96e')
      root.style.setProperty('--color-bg', p.theme_bg_color || '#faf6f0')
      root.style.setProperty('--color-accent', p.theme_accent || '#8b6f47')
      if (p.background_image_url) {
        document.body.style.backgroundImage = `url(${p.background_image_url})`
        document.body.style.backgroundSize = 'cover'
        document.body.style.backgroundAttachment = 'fixed'
      }

      const today = new Date().toISOString().split('T')[0]
      const [logs, rulebooks, scenarios, pairs, availability, schedules] = await Promise.all([
        playLogsApi.getAll(p.id),
        rulebooksApi.getAll(p.id),
        scenariosApi.getAll(p.id),
        pairsApi.getAll(p.id),
        supabase.from('availability').select('*').eq('user_id', p.id).eq('is_active', true),
        supabase.from('schedules').select('*').eq('user_id', p.id)
          .gte('scheduled_date', today)
          .neq('status', 'cancelled')
          .order('scheduled_date'),
      ])

      setData({
        logs: logs.data || [],
        rulebooks: rulebooks.data || [],
        scenarios: scenarios.data || [],
        pairs: pairs.data || [],
        availability: availability.data || [],
        schedules: schedules.data || [],
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

  const TABS = [
    { key: 'schedules', label: '📅 일정', count: data.schedules?.length },
    { key: 'logs', label: '📖 기록', count: data.logs?.length },
    { key: 'rulebooks', label: '📚 룰북', count: data.rulebooks?.length },
    { key: 'scenarios', label: '🗺️ 시나리오', count: data.scenarios?.length },
    { key: 'pairs', label: '👥 페어', count: data.pairs?.length },
    { key: 'availability', label: '📋 공수표', count: data.availability?.length },
    { key: 'guestbook', label: '💌 방명록' },
  ]

  return (
    <div style={{maxWidth:820,margin:'0 auto',padding:'36px 20px'}}>
      {/* 프로필 헤더 */}
      <div className="card card-lg" style={{marginBottom:28,textAlign:'center'}}>
        <div className="user-avatar" style={{width:64,height:64,fontSize:'1.8rem',margin:'0 auto 14px'}}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" /> : (profile.display_name||'?')[0]}
        </div>
        <h1 style={{fontSize:'1.6rem',fontWeight:700,color:'var(--color-accent)',letterSpacing:'-0.03em'}}>{profile.display_name || profile.username}</h1>
        <p className="text-sm text-light" style={{marginTop:3}}>@{profile.username}</p>
        {profile.bio && <p style={{marginTop:12,color:'var(--color-text-light)',lineHeight:1.7,maxWidth:460,margin:'12px auto 0',fontSize:'0.85rem'}}>{profile.bio}</p>}

        <div className="flex justify-between" style={{marginTop:18,padding:'14px 0',borderTop:'1px solid var(--color-border)',borderBottom:'1px solid var(--color-border)'}}>
          {[
            {label:'기록',v:data.logs?.length||0},
            {label:'룰북',v:data.rulebooks?.length||0},
            {label:'시나리오',v:data.scenarios?.length||0},
            {label:'페어',v:data.pairs?.length||0},
          ].map(s=>(
            <div key={s.label} style={{textAlign:'center',flex:1}}>
              <div style={{fontSize:'1.4rem',color:'var(--color-accent)',fontWeight:700}}>{s.v}</div>
              <div className="text-xs text-light">{s.label}</div>
            </div>
          ))}
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

      {/* ── 일정 탭 ── */}
      {activeTab === 'schedules' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.schedules?.length === 0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>예정된 일정이 없어요</div>
            : data.schedules?.map(s=>(
              <div key={s.id} className="card card-sm" style={{display:'flex',gap:14,alignItems:'center'}}>
                <div style={{background:'rgba(200,169,110,0.1)',borderRadius:8,padding:'7px 11px',textAlign:'center',minWidth:48,flexShrink:0}}>
                  <div style={{fontSize:'0.62rem',color:'var(--color-text-light)'}}>{format(new Date(s.scheduled_date),'M월',{locale:ko})}</div>
                  <div style={{fontSize:'1.2rem',color:'var(--color-accent)',fontWeight:700,lineHeight:1}}>{format(new Date(s.scheduled_date),'d')}</div>
                  <div style={{fontSize:'0.62rem',color:'var(--color-text-light)'}}>{format(new Date(s.scheduled_date),'EEE',{locale:ko})}</div>
                </div>
                <div style={{flex:1}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:'0.88rem'}}>{s.title}</span>
                    {s.is_gm && <span className="badge badge-primary">GM</span>}
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {s.system_name && <span>🎲 {s.system_name}</span>}
                    {s.scheduled_time && <span>🕐 {s.scheduled_time}</span>}
                    {s.location && <span>🖥️ {s.location}</span>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 기록 탭 ── */}
      {activeTab === 'logs' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.logs?.length === 0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>아직 기록이 없어요</div>
            : data.logs?.map(l=>(
              <div key={l.id} className="card card-sm" style={{display:'flex',gap:14}}>
                <div style={{background:'rgba(200,169,110,0.1)',borderRadius:8,padding:'7px 11px',textAlign:'center',minWidth:48,flexShrink:0}}>
                  <div style={{fontSize:'0.62rem',color:'var(--color-text-light)'}}>{format(new Date(l.played_date),'yyyy')}</div>
                  <div style={{fontSize:'0.95rem',color:'var(--color-accent)',fontWeight:700}}>{format(new Date(l.played_date),'M/d')}</div>
                </div>
                <div style={{flex:1}}>
                  <div className="flex items-center gap-8" style={{marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:'0.88rem'}}>{l.title}</span>
                    <span className={`badge ${l.role==='GM'?'badge-primary':'badge-blue'}`}>{l.role}</span>
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {l.system_name && <span>🎲 {l.system_name}</span>}
                  </div>
                  {l.rating>0 && <div className="stars" style={{fontSize:'0.78rem',marginTop:3}}>{'★'.repeat(l.rating)}{'☆'.repeat(5-l.rating)}</div>}
                  {l.memo && <p style={{fontSize:'0.8rem',color:'var(--color-text-light)',marginTop:4}}>{l.memo}</p>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 룰북 탭 ── */}
      {activeTab === 'rulebooks' && (
        <div className="grid-auto">
          {data.rulebooks?.length === 0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>룰북이 없어요</div>
            : data.rulebooks?.map(r=>(
              <div key={r.id} className="card">
                {r.cover_image_url && <img src={r.cover_image_url} alt={r.title} style={{width:'100%',height:100,objectFit:'cover',borderRadius:6,marginBottom:8}} />}
                <h3 style={{fontWeight:700,fontSize:'0.88rem',marginBottom:5}}>{r.title}</h3>
                <div className="text-sm text-light">
                  {r.system_name && <div>🎲 {r.system_name}</div>}
                  {r.publisher && <div>🏢 {r.publisher}</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 시나리오 탭 ── */}
      {activeTab === 'scenarios' && (
        <div className="grid-auto">
          {data.scenarios?.length === 0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>시나리오가 없어요</div>
            : data.scenarios?.map(s=>(
              <div key={s.id} className="card">
                {s.cover_image_url && <img src={s.cover_image_url} alt={s.title} style={{width:'100%',height:88,objectFit:'cover',borderRadius:6,marginBottom:8}} />}
                <div className="flex gap-8" style={{marginBottom:6}}>
                  <span className="badge badge-gray">{SCENARIO_STATUS[s.status]}</span>
                  {s.difficulty && <span className="badge badge-primary">{DIFF_MAP[s.difficulty]}</span>}
                </div>
                <h3 style={{fontWeight:700,fontSize:'0.88rem',marginBottom:4}}>{s.title}</h3>
                <div className="text-sm text-light">
                  {s.system_name && <div>🎲 {s.system_name}</div>}
                  {s.player_count && <div>👥 {s.player_count}인</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 페어 탭 ── */}
      {activeTab === 'pairs' && (
        <div className="grid-auto">
          {data.pairs?.length === 0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>페어 목록이 없어요</div>
            : data.pairs?.map(p=>(
              <div key={p.id} className="card card-sm flex items-center gap-12">
                <div style={{width:38,height:38,borderRadius:'50%',background:p.avatar_color||'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,flexShrink:0,fontSize:'0.9rem'}}>
                  {(p.name||'?')[0]}
                </div>
                <div>
                  <div style={{fontWeight:600,fontSize:'0.88rem'}}>{p.name}</div>
                  {p.nickname && <div className="text-xs text-light">@{p.nickname}</div>}
                  {p.play_count>0 && <div className="text-xs text-light">🎲 {p.play_count}회</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 공수표 탭 ── */}
      {activeTab === 'availability' && (
        <div className="grid-auto">
          {data.availability?.length === 0
            ? <div className="card" style={{textAlign:'center',padding:36,color:'var(--color-text-light)',fontSize:'0.85rem'}}>활성화된 공수표가 없어요</div>
            : data.availability?.map(a=>(
              <div key={a.id} className="card">
                <div className="flex gap-8" style={{marginBottom:8}}>
                  <span className="badge badge-green">활성</span>
                  <span className="badge badge-primary">{a.role}</span>
                </div>
                <h3 style={{fontWeight:600,marginBottom:7,fontSize:'0.88rem'}}>{a.title}</h3>
                <div className="text-sm text-light" style={{display:'flex',flexDirection:'column',gap:3}}>
                  {a.system_name && <span>🎲 {a.system_name}</span>}
                  {a.preferred_days?.length>0 && <span>📅 {a.preferred_days.join(', ')}요일</span>}
                  {a.preferred_time && <span>🕐 {a.preferred_time}</span>}
                </div>
                {a.description && <p style={{fontSize:'0.82rem',color:'var(--color-text-light)',marginTop:7}}>{a.description}</p>}
                {a.contact && <div style={{fontSize:'0.82rem',marginTop:7}}>📬 {a.contact}</div>}
              </div>
            ))
          }
        </div>
      )}

      {/* ── 방명록 탭 ── */}
      {activeTab === 'guestbook' && (
        <GuestbookPage ownerId={profile.id} />
      )}
    </div>
  )
}
