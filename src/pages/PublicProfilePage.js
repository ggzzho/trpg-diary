// src/pages/PublicProfilePage.js
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProfile, playLogsApi, rulebooksApi, scenariosApi, pairsApi, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { applyTheme, applyBackground } from '../context/ThemeContext'
import { GuestbookPublicView } from './GuestbookPage'
import { LogDetailContent } from './PlayLogPage'
import { FOOTER_TEXT, Modal } from '../components/Layout'
import { Mi } from '../components/Mi'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday, addMonths, subMonths
} from 'date-fns'
import { ko } from 'date-fns/locale'

const SCENARIO_STATUS = { unplayed:'미플', played:'PL완료', gm_done:'GM완료', want:'위시' }

function calcDday(d) {
  if (!d) return null
  return Math.floor((new Date() - new Date(d)) / 86400000)
}

// ── 공개 페이지 태그칩: 불투명 ──
const TC = {
  series: { bg:'#c8a96e', color:'#fff', border:'#b8944e' },
  role_PL: { bg:'#4a7ad4', color:'#fff', border:'#3a6ac4' },
  role_GM: { bg:'#7a5ab8', color:'#fff', border:'#6a4aa8' },
  rule: { bg:'#5a8a40', color:'#fff', border:'#4a7a30' },
}
function Chip({ type, label }) {
  const c = type==='series' ? TC.series : type==='role' ? (label==='GM' ? TC.role_GM : TC.role_PL) : TC.rule
  return (
    <span style={{ display:'inline-flex', padding:'2px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:700,
      background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

// ── 미니 캘린더 ──
function PublicCalendar({ schedules }) {
  const [cal, setCal] = useState(new Date())
  const s0 = startOfWeek(startOfMonth(cal), { weekStartsOn:0 })
  const e0 = endOfWeek(endOfMonth(cal), { weekStartsOn:0 })
  const rows = []
  let day = s0
  while (day <= e0) {
    const d = day
    const dStr = format(d,'yyyy-MM-dd')
    const dayScheds = schedules.filter(s=>s.scheduled_date===dStr)
    const inMonth = isSameMonth(d,cal)
    const today = isToday(d)
    rows.push(
      <div key={dStr} style={{
        minHeight:64, padding:'4px 5px', borderRadius:7,
        background: today ? 'var(--color-primary)' : inMonth ? 'var(--color-surface)' : 'transparent',
        border: today ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
        opacity: inMonth ? 1 : 0.35,
      }}>
        <div style={{ fontSize:'0.68rem', fontWeight: today?700:500, color: today?'white':'var(--color-text-light)', marginBottom:3 }}>{format(d,'d')}</div>
        {dayScheds.map((s,i)=>(
          <div key={i} style={{ fontSize:'0.6rem', background:'var(--color-accent)', color:'white', borderRadius:3, padding:'1px 4px', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
        ))}
      </div>
    )
    day = addDays(day,1)
  }
  return (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom:14 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCal(subMonths(cal,1))}><Mi size="sm">chevron_left</Mi></button>
        <span className="text-serif" style={{ fontWeight:700, color:'var(--color-accent)' }}>{format(cal,'yyyy년 M월',{locale:ko})}</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCal(addMonths(cal,1))}><Mi size="sm">chevron_right</Mi></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:6 }}>
        {['일','월','화','수','목','금','토'].map((d,i) => (
          <div key={d} style={{
            textAlign:'center', fontSize:'0.65rem', fontWeight:600,
            color: i===0 ? '#e57373' : i===6 ? '#6b8cba' : 'var(--color-text-light)', padding:'3px 0'
          }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>{rows}</div>
    </div>
  )
}

// ── 메인 컴포넌트 ──
export default function PublicProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('schedules')
  const [selectedLog, setSelectedLog] = useState(null)
  const [pairSort, setPairSort] = useState('asc')

  useEffect(() => {
    const load = async () => {
      const { data:p, error } = await getProfile(username)
      if (error || !p) { setNotFound(true); setLoading(false); return }
      setProfile(p)
      applyTheme(p.theme_color||'#c8a96e', p.theme_bg_color||'#faf6f0', p.theme_accent||'#8b6f47')
      applyBackground(p.background_image_url||'', p.bg_opacity !== undefined ? p.bg_opacity : 1)

      const today = new Date().toISOString().split('T')[0]
      const safe = async fn => { try { const r = await fn; return r.data || [] } catch { return [] } }
      const [logs, rulebooks, scenarios, pairs, avail, scheds] = await Promise.all([
        safe(playLogsApi.getAll(p.id)),
        safe(supabase.from('rulebooks').select('*').eq('user_id', p.id).order('title').then(r=>r)),
        safe(scenariosApi.getAll(p.id)),
        safe(pairsApi.getAll(p.id)),
        safe(supabase.from('availability').select('*').eq('user_id',p.id).eq('is_active',true).then(r=>r)),
        safe(supabase.from('schedules').select('*').eq('user_id',p.id)
          .gte('scheduled_date',today).neq('status','cancelled').neq('status','completed')
          .order('scheduled_date').then(r=>r)),
      ])
      setData({ logs, rulebooks, scenarios, pairs, availability:avail, schedules:scheds })
      setLoading(false)
    }
    load()
  }, [username, user])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--color-text-light)', fontSize:'0.88rem' }}>불러오는 중...</div>
    </div>
  )
  if (notFound) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center' }}>
        <Mi size='lg' style={{fontSize:40,marginBottom:14}}>description</Mi>
        <h1 style={{ fontWeight:700, color:'var(--color-accent)', marginBottom:7, fontSize:'1.3rem' }}>페이지를 찾을 수 없어요</h1>
        <p style={{ color:'var(--color-text-light)', fontSize:'0.85rem' }}>@{username} 사용자가 없거나 비공개예요</p>
      </div>
    </div>
  )

  const sections = (() => {
    if (profile.profile_sections?.length > 0) return profile.profile_sections
    const l = []
    if (profile.play_style) l.push({ label:'플레이 스타일', value:profile.play_style })
    if (profile.caution) l.push({ label:'주의 사항', value:profile.caution })
    if (profile.extra_info) l.push({ label:'기타 사항', value:profile.extra_info })
    return l
  })()

  const TABS = [
    { key:'schedules', label:'일정', icon:'calendar_month', count:data.schedules?.length },
    { key:'rulebooks', label:'룰북', icon:'menu_book', count:(data.rulebooks||[]).filter(r=>!r.parent_id).length },
    { key:'logs', label:'기록', icon:'auto_stories', count:data.logs?.length },
    { key:'availability', label:'공수표', icon:'event_available', count:data.availability?.length },
    { key:'scenarios', label:'시나리오', icon:'description', count:data.scenarios?.length },
    { key:'pairs', label:'페어', icon:'people', count:data.pairs?.length },
    { key:'guestbook', label:'방명록', icon:'mail' },
  ]

  const sortedPairs = [...(data.pairs||[])].sort((a,b) => {
    const da = a.first_met_date||'', db = b.first_met_date||''
    return pairSort === 'asc' ? da.localeCompare(db) : db.localeCompare(da)
  })

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 20px 0' }}>

      {/* 프로필 카드 */}
      <div className="card" style={{ marginBottom:24, overflow:'visible', padding:0 }}>
        {/* 헤더 이미지 */}
        <div style={{ height:235, background:'var(--color-nav-active-bg)', borderRadius:'var(--radius) var(--radius) 0 0', overflow:'hidden' }}>
          {profile.header_image_url
            ? <img src={profile.header_image_url} alt="header"
                style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>
            : <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,var(--color-primary),var(--color-accent))`, opacity:0.3 }}/>
          }
        </div>

        <div style={{ padding:'0 24px 24px', textAlign:'center' }}>
          {/* 아바타 */}
          <div style={{ display:'flex', justifyContent:'center', marginTop:-60, marginBottom:12 }}>
            <div className="user-avatar" style={{
              width:120, height:120, fontSize:'2.8rem',
              border:'4px solid white', boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
              background:'var(--color-surface)', position:'relative', zIndex:2
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar"/>
                : (profile.display_name||'?')[0]
              }
            </div>
          </div>

          <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--color-accent)', letterSpacing:'-0.03em', marginBottom:2 }}>
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-light">@{profile.username}</p>

          {/* 통계 */}
          <div className="flex justify-between" style={{ marginTop:16, padding:'12px 0', borderTop:'1px solid var(--color-border)', borderBottom:'1px solid var(--color-border)' }}>
            {[
              { label:'기록', v:data.logs?.length||0 },
              { label:'룰북', v:(data.rulebooks||[]).filter(r=>!r.parent_id).length },
              { label:'시나리오', v:data.scenarios?.length||0 },
              { label:'페어', v:data.pairs?.length||0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', flex:1 }}>
                <div style={{ fontSize:'1.3rem', color:'var(--color-accent)', fontWeight:700 }}>{s.v}</div>
                <div className="text-xs text-light">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 프로필 소개 */}
          {sections.filter(s=>s.value).length > 0 && (
            <div style={{ marginTop:16, textAlign:'left', display:'flex', flexDirection:'column', gap:12 }}>
              {sections.filter(s=>s.value).map((sec,i) => (
                <div key={i}>
                  <div style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--color-accent)', marginBottom:4 }}>{sec.label}</div>
                  <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{sec.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 외부 링크 */}
          {profile.external_links?.length > 0 && (
            <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
              {profile.external_links.map((link,i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer"
                  style={{ padding:'4px 12px', borderRadius:100, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', fontSize:'0.76rem', fontWeight:600, textDecoration:'none' }}>
                  <Mi size="sm">link</Mi> {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-8" style={{ marginBottom:20, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key}
            className={`btn btn-sm ${activeTab===t.key?'btn-primary':'btn-outline'}`}
            onClick={() => setActiveTab(t.key)}
            style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Mi size="sm" color={activeTab===t.key?'white':'accent'}>{t.icon}</Mi>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── 일정 (캘린더) ── */}
      {activeTab==='schedules' && <PublicCalendar schedules={data.schedules||[]}/>}

      {/* ── 기록 (카드 + 팝업) ── */}
      {activeTab==='logs' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(238px,1fr))', gap:13 }}>
            {!data.logs?.length
              ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem', gridColumn:'1/-1' }}>아직 기록이 없어요</div>
              : data.logs.map(l => (
                <div key={l.id}
                  style={{ borderRadius:12, overflow:'hidden', background:'var(--color-surface)', border:'1px solid var(--color-border)', boxShadow:'0 2px 12px var(--color-shadow)', display:'flex', flexDirection:'column', cursor:'pointer', transition:'transform 0.15s,box-shadow 0.15s' }}
                  onClick={() => setSelectedLog(l)}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px var(--color-shadow)'}}
                >
                  <div style={{ position:'relative', paddingTop:'56.25%' }}>
                    <div style={{ position:'absolute', inset:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      {l.session_image_url
                        ? <img src={l.session_image_url} alt={l.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <span style={{ fontSize:'2.5rem', opacity:0.2 }}><Mi size='lg' color='light'>auto_stories</Mi></span>
                      }
                    </div>
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'65%', background:'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.3) 55%,transparent 100%)', pointerEvents:'none' }}/>
                    <div style={{ position:'absolute', bottom:8, left:8, right:8, display:'flex', gap:4, flexWrap:'wrap' }}>
                      {l.series_tag && <Chip type="series" label={l.series_tag}/>}
                      <Chip type="role" label={l.role}/>
                      {l.system_name && <Chip type="rule" label={l.system_name}/>}
                    </div>
                  </div>
                  <div style={{ padding:'10px 12px 12px', flex:1, display:'flex', flexDirection:'column' }}>
                    <div style={{ fontWeight:700, fontSize:'1rem', lineHeight:1.3, marginBottom:8 }}>{l.title}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {(l.together_with||l.character_name) && (
                        <div style={{ fontSize:'0.79rem', color:'var(--color-text-light)', display:'flex', gap:12, flexWrap:'wrap' }}>
                          {l.together_with && <span><span style={{ fontWeight:600, marginRight:4 }}>GM.</span>{l.together_with}</span>}
                          {l.character_name && <span><span style={{ fontWeight:600, marginRight:4 }}>PL.</span>{l.character_name}</span>}
                        </div>
                      )}
                      {l.npc && <div style={{ fontSize:'0.79rem', color:'var(--color-text-light)' }}><span style={{ fontWeight:600, marginRight:4 }}>등장인물.</span>{l.npc}</div>}
                      {(l.start_date||l.played_date) && (
                        <div style={{ fontSize:'0.79rem', color:'var(--color-text-light)', display:'flex', gap:14, flexWrap:'wrap' }}>
                          {l.start_date && <span><span style={{ fontWeight:600, marginRight:4 }}>Start.</span>{format(new Date(l.start_date),'yyyy.MM.dd')}</span>}
                          {l.played_date && <span><span style={{ fontWeight:600, marginRight:4 }}>End.</span>{format(new Date(l.played_date),'yyyy.MM.dd')}</span>}
                        </div>
                      )}
                    </div>
                    {l.rating > 0 && <div className="stars" style={{ fontSize:'0.82rem', marginTop:6 }}>{'★'.repeat(l.rating)}{'☆'.repeat(5-l.rating)}</div>}
                    {l.spoiler_content && <div style={{ fontSize:'0.75rem', color:'#e57373', marginTop:4 }}>⚠️ 스포일러 포함</div>}
                  </div>
                </div>
              ))
            }
          </div>
          <Modal isOpen={!!selectedLog} onClose={()=>setSelectedLog(null)} title={selectedLog?.title}
            footer={<button className="btn btn-outline btn-sm" onClick={()=>setSelectedLog(null)}>닫기</button>}
          >
            {selectedLog && <LogDetailContent detail={selectedLog}/>}
          </Modal>
        </>
      )}

      {/* ── 룰북 ── */}
      {activeTab==='rulebooks' && (() => {
        const parents = (data.rulebooks||[]).filter(r => !r.parent_id)
        const supplMap = {}
        ;(data.rulebooks||[]).filter(r => r.parent_id).forEach(r => {
          if (!supplMap[r.parent_id]) supplMap[r.parent_id] = []
          supplMap[r.parent_id].push(r)
        })

        const RbRow = ({r, isChild}) => (
          <div style={{ display:'flex', alignItems:'center', gap:14, padding: isChild ? '8px 14px 8px 52px' : '10px 14px', background: isChild ? 'var(--color-nav-active-bg)' : 'transparent', borderTop: isChild ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ width:40, height:40, borderRadius:7, overflow:'hidden', flexShrink:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {r.cover_image_url ? <img src={r.cover_image_url} alt={r.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.2rem', opacity:0.35 }}><Mi size='lg' color='light'>menu_book</Mi></span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight: isChild ? 500 : 700, fontSize:'0.9rem', marginBottom:3, display:'flex', alignItems:'center', gap:6 }}>
                {isChild && <span style={{ fontSize:'0.65rem', color:'var(--color-text-light)', opacity:0.7 }}>└</span>}
                {r.title}
              </div>
              {r.tags?.length > 0 && <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:3 }}>{r.tags.map(t => <span key={t} style={{ padding:'1px 7px', borderRadius:100, fontSize:'0.62rem', fontWeight:600, background:'var(--color-nav-active-bg)', color:'var(--color-accent)', border:'1px solid var(--color-border)' }}>{t}</span>)}</div>}
            </div>
          </div>
        )
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {!parents.length
              ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>룰북이 없어요</div>
              : parents.map(r => (
                <div key={r.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                  <RbRow r={r} isChild={false}/>
                  {(supplMap[r.id]||[]).map(s => <RbRow key={s.id} r={s} isChild={true}/>)}
                </div>
              ))
            }
          </div>
        )
      })()}

      {/* ── 시나리오 ── */}
      {activeTab==='scenarios' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {!data.scenarios?.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>시나리오가 없어요</div>
            : data.scenarios.map(s => (
              <div key={s.id} className="card card-sm" style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:48, height:48, borderRadius:8, overflow:'hidden', flexShrink:0, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {s.cover_image_url ? <img src={s.cover_image_url} alt={s.title} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.5rem', opacity:0.4 }}><Mi size='lg' color='light'>description</Mi></span>}
                </div>
                <div style={{ flex:1 }}>
                  <div className="flex items-center gap-8" style={{ marginBottom:5 }}>
                    <span style={{ fontWeight:700, fontSize:'0.9rem' }}>{s.title}</span>
                    <span className="badge badge-gray">{SCENARIO_STATUS[s.status]}</span>
                  </div>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    {s.system_name && <span className="text-xs text-light"><Mi size='sm' color='light'>sports_esports</Mi> {s.system_name}</span>}
                    {s.author && <span className="text-xs text-light"><Mi size='sm' color='light'>edit</Mi> {s.author}</span>}
                    {s.player_count && <span className="text-xs text-light"><Mi size="sm" color="light">group</Mi> {s.player_count}</span>}
                  </div>
                  {s.scenario_url && <a href={s.scenario_url} target="_blank" rel="noreferrer" style={{ fontSize:'0.7rem', color:'var(--color-primary)', marginTop:3, display:'block' }}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 페어 ── */}
      {activeTab==='pairs' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <button className={`btn btn-sm ${pairSort==='asc'?'btn-primary':'btn-outline'}`} onClick={()=>setPairSort('asc')}><Mi size='sm'>arrow_upward</Mi> 오름차순</button>
            <button className={`btn btn-sm ${pairSort==='desc'?'btn-primary':'btn-outline'}`} onClick={()=>setPairSort('desc')}><Mi size='sm'>arrow_downward</Mi> 내림차순</button>
          </div>
          <div className="grid-auto">
            {!sortedPairs.length
              ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>페어 목록이 없어요</div>
              : sortedPairs.map(p => {
                const dday = calcDday(p.first_met_date)
                return (
                  <div key={p.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                    <div style={{ height:160, background:'var(--color-nav-active-bg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
                      {p.pair_image_url ? <img src={p.pair_image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'4rem', opacity:0.25 }}>👤</span>}
                      {dday !== null && (
                        <div style={{ position:'absolute', top:10, right:10, background:'var(--color-primary)', color:'white', borderRadius:8, padding:'4px 10px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
                          <div style={{ fontSize:'0.6rem', opacity:0.85 }}>함께한 지</div>
                          <div style={{ fontSize:'1.1rem', fontWeight:700, lineHeight:1.2 }}>D+{dday}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding:'12px 14px' }}>
                      <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:4 }}>{p.name}</div>
                      {p.relations?.length > 0 && (
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                          {p.relations.map(r => <span key={r} className="badge badge-primary">{r}</span>)}
                        </div>
                      )}
                      {p.first_met_date && <div className="text-xs text-light"><Mi size='sm' color='light'>calendar_today</Mi> {p.first_met_date} 첫 만남</div>}
                      {p.memo && <p className="text-xs text-light" style={{ marginTop:8, borderTop:'1px solid var(--color-border)', paddingTop:8 }}>{p.memo}</p>}
                    </div>
                  </div>
                )
              })
            }
          </div>
        </>
      )}

      {/* ── 공수표 ── */}
      {activeTab==='availability' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!data.availability?.length
            ? <div className="card" style={{ textAlign:'center', padding:36, color:'var(--color-text-light)', fontSize:'0.85rem' }}>활성화된 공수표가 없어요</div>
            : data.availability.map(a => (
              <div key={a.id} className="card card-sm">
                <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div className="flex gap-8" style={{ flexShrink:0, paddingTop:2 }}>
                    <span className="badge badge-green">활성</span>
                    <span className="badge badge-primary">{a.role}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:4 }}>{a.title}</div>
                    <div className="text-xs text-light flex gap-12" style={{ marginBottom:a.description||a.together_with?5:0 }}>
                      {a.system_name && <span><Mi size='sm' color='light'>sports_esports</Mi> {a.system_name}</span>}
                      {a.together_with && <span>👤 {a.together_with}</span>}
                    </div>
                    {a.description && <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)' }}>{a.description}</p>}
                    {a.scenario_link && <a href={a.scenario_link} target="_blank" rel="noreferrer" style={{ fontSize:'0.78rem', color:'var(--color-primary)', display:'block', marginTop:5 }}><Mi size='sm'>link</Mi> 시나리오 링크</a>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 방명록 ── */}
      {activeTab==='guestbook' && <GuestbookPublicView ownerId={profile.id}/>}

      {/* 푸터 */}
      <footer style={{ marginTop:60, paddingTop:20, paddingBottom:20, borderTop:'1px solid var(--color-border)', textAlign:'center', color:'var(--color-text-light)', fontSize:'0.72rem' }}>
        {FOOTER_TEXT}
      </footer>
    </div>
  )
}
