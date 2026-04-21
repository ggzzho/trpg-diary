// src/components/supporter/BgmPlayer.js
import React, { useState, useEffect, useRef } from 'react'
import { Mi } from '../Mi'

const MAX_TRACKS = 12

const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// YouTube Video ID 추출
const extractVideoId = (url) => {
  if (!url) return null
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// YouTube IFrame API 로드 (싱글톤)
let _apiStatus = 'idle'
const _apiCallbacks = []
function loadYTApi(cb) {
  if (_apiStatus === 'ready' && window.YT?.Player) { cb(); return }
  _apiCallbacks.push(cb)
  if (_apiStatus === 'loading') return
  _apiStatus = 'loading'
  window.onYouTubeIframeAPIReady = () => {
    _apiStatus = 'ready'
    _apiCallbacks.splice(0).forEach(fn => fn())
  }
  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
}

export default function BgmPlayer({ profile, isOwner, onSave }) {
  // ── 플레이리스트 데이터 (bgm_url 단일트랙 하위호환 포함) ──
  const rawPlaylist  = profile?.bgm_playlist || []
  const resolvedList = rawPlaylist.length === 0 && profile?.bgm_url
    ? [{ url: profile.bgm_url, title: profile.bgm_title || '' }]
    : rawPlaylist
  const videoIds = resolvedList.map(t => extractVideoId(t.url)).filter(Boolean)
  const hasVideo = videoIds.length > 0

  // ── 플레이어 refs ──
  const playerRef    = useRef(null)
  const containerRef = useRef(null)

  // ── 드래그앤드롭 refs ──
  const dragIdx     = useRef(null)
  const dragOverIdx = useRef(null)

  // ── 플레이어 상태 ──
  const [ready,        setReady]        = useState(false)
  const [playing,      setPlaying]      = useState(false)
  const [volume,       setVolume]       = useState(50)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ── Seek 상태 ──
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const seekIntervalRef = useRef(null)

  // ── UI 상태 ──
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // ── BGM 말풍선 (방문자 첫 접속 시 1회) ──
  const BUBBLE_KEY = 'bgm_bubble_shown'
  const [showBubble, setShowBubble] = useState(false)
  useEffect(() => {
    if (!hasVideo) return
    if (sessionStorage.getItem(BUBBLE_KEY)) return
    setShowBubble(true)
    const t = setTimeout(() => {
      setShowBubble(false)
      sessionStorage.setItem(BUBBLE_KEY, '1')
    }, 2500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVideo])

  // ── 편집 폼 상태 ──
  const [editList, setEditList] = useState([])
  const [newUrl,   setNewUrl]   = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [dragOverAt, setDragOverAt] = useState(null) // 드롭 위치 시각 표시

  // ── YouTube 플레이어 초기화 ──
  const videoIdsStr = videoIds.join(',')
  useEffect(() => {
    if (!hasVideo || !containerRef.current) return
    setReady(false)
    setPlaying(false)
    setCurrentIndex(0)

    loadYTApi(() => {
      if (!containerRef.current) return
      try { playerRef.current?.destroy() } catch {}

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoIds[0],
        height: '1',
        width:  '1',
        playerVars: { autoplay:0, controls:0, disablekb:1, fs:0, rel:0 },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume)
            // 전체 플레이리스트를 큐에 올리고 루프 설정
            e.target.cuePlaylist(videoIds)
            e.target.setLoop(true)
            setReady(true)
          },
          onStateChange: (e) => {
            if (!window.YT) return
            setPlaying(e.data === window.YT.PlayerState.PLAYING)
            try {
              const idx = playerRef.current?.getPlaylistIndex()
              if (idx != null && idx >= 0) setCurrentIndex(idx)
            } catch {}
          },
          onError: () => {
            // 재생 불가 영상 자동 스킵
            try { playerRef.current?.nextVideo() } catch {}
          },
        },
      })
    })

    return () => {
      try { playerRef.current?.destroy() } catch {}
      playerRef.current = null
      setReady(false)
      setPlaying(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoIdsStr])

  // ── Seek 폴링 (재생 중 0.5초마다 시간 갱신) ──
  useEffect(() => {
    clearInterval(seekIntervalRef.current)
    if (playing && ready) {
      seekIntervalRef.current = setInterval(() => {
        try {
          const ct  = playerRef.current?.getCurrentTime() || 0
          const dur = playerRef.current?.getDuration()    || 0
          setCurrentTime(ct)
          setDuration(dur)
        } catch {}
      }, 500)
    }
    return () => clearInterval(seekIntervalRef.current)
  }, [playing, ready])

  // ── 플레이어 컨트롤 ──
  const togglePlay = () => {
    if (!playerRef.current) return
    playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo()
  }
  const handlePrev   = () => { try { playerRef.current?.previousVideo() } catch {} }
  const handleNext   = () => { try { playerRef.current?.nextVideo()     } catch {} }
  const handleVolume = (v) => {
    setVolume(v)
    try { playerRef.current?.setVolume(v) } catch {}
  }
  const handleSeek = (v) => {
    setCurrentTime(v)
    try { playerRef.current?.seekTo(v, true) } catch {}
  }
  const playTrackAt = (i) => {
    try {
      playerRef.current?.playVideoAt(i)
      setCurrentIndex(i)
      setCurrentTime(0)
    } catch {}
  }

  // ── 편집 열기 ──
  const openEdit = () => {
    setEditList(resolvedList.map(t => ({ ...t })))
    setNewUrl('')
    setNewTitle('')
    setEditing(true)
  }

  // ── 트랙 추가 ──
  const addTrack = () => {
    const url = newUrl.trim()
    if (!url || editList.length >= MAX_TRACKS) return
    setEditList(prev => [...prev, { url, title: newTitle.trim() }])
    setNewUrl('')
    setNewTitle('')
  }

  // ── 트랙 삭제 ──
  const removeTrack = (i) =>
    setEditList(prev => prev.filter((_, idx) => idx !== i))

  // ── 드래그앤드롭 ──
  const handleDragStart = (i) => { dragIdx.current = i }
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragOverIdx.current !== i) {
      dragOverIdx.current = i
      setDragOverAt(i)
    }
  }
  const handleDrop = (i) => {
    const from = dragIdx.current
    if (from === null || from === i) { handleDragEnd(); return }
    const list = [...editList]
    const [moved] = list.splice(from, 1)
    list.splice(i, 0, moved)
    setEditList(list)
    handleDragEnd()
  }
  const handleDragEnd = () => {
    dragIdx.current    = null
    dragOverIdx.current = null
    setDragOverAt(null)
  }

  // ── 설정 저장 ──
  const saveSettings = async () => {
    setSaving(true)
    await onSave({
      bgm_playlist: editList,
      bgm_autoplay: profile?.bgm_autoplay || false,
    })
    setSaving(false)
    setEditing(false)
  }

  // 데이터 없고 오너도 아님 → 렌더링 안 함
  if (!hasVideo && !isOwner) return null

  const currentTrack = resolvedList[currentIndex] || resolvedList[0]
  const displayTitle = (currentTrack?.title || 'BGM').slice(0, 24)

  return (
    <>
      {/* 숨겨진 플레이어 컨테이너 */}
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0, pointerEvents:'none' }}>
        <div ref={containerRef}/>
      </div>

      {/* ── 플레이어 위젯 ── */}
      <div style={{
        position:'fixed', bottom:116, right:20, zIndex:9999,
        background:'var(--color-surface)',
        border:'1px solid var(--color-border)',
        borderRadius: expanded ? 16 : 100,
        boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
        backdropFilter:'blur(12px)',
        overflow:'hidden',
        transition:'border-radius 0.2s',
        minWidth: expanded ? 270 : 36,
      }}>
        {!expanded ? (
          /* 접힌 상태: 아이콘만 */
          <div style={{ position:'relative' }}>
            <button
              onClick={() => setExpanded(true)}
              style={{
                width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                background:'none', border:'none', cursor:'pointer',
                color: playing ? 'var(--color-primary)' : 'var(--color-text-light)',
              }}
              title="BGM 플레이어"
            >
              <Mi size="sm">music_note</Mi>
            </button>
            {playing && (
              <span style={{
                position:'absolute', top:4, right:4,
                width:8, height:8, borderRadius:'50%',
                background:'var(--color-primary)',
              }}/>
            )}
          </div>
        ) : (
          /* 펼친 상태 */
          <div style={{ padding:'10px 14px', minWidth:250 }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <Mi size="sm" color="accent">music_note</Mi>
              <span style={{
                fontSize:'0.8rem', fontWeight:700, flex:1, color:'var(--color-accent)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>
                {displayTitle}
              </span>
              {resolvedList.length > 1 && (
                <span style={{ fontSize:'0.7rem', color:'var(--color-text-light)', flexShrink:0 }}>
                  {currentIndex + 1} / {resolvedList.length}
                </span>
              )}
              <button
                onClick={() => setExpanded(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-light)', fontSize:'1rem', lineHeight:1, padding:'0 2px' }}
              >×</button>
            </div>

            {hasVideo ? (
              <>
                {/* 재생 컨트롤 */}
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
                  {resolvedList.length > 1 && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handlePrev}
                      disabled={!ready}
                      style={{ padding:'4px 10px', fontSize:'0.85rem' }}
                      title="이전 곡"
                    >⏮</button>
                  )}
                  <button
                    className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-primary'}`}
                    onClick={togglePlay}
                    disabled={!ready}
                    style={{ flex:1, fontSize:'0.78rem' }}
                  >
                    {!ready ? '로딩 중...' : playing ? '⏸ 일시정지' : '▶ 재생'}
                  </button>
                  {resolvedList.length > 1 && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleNext}
                      disabled={!ready}
                      style={{ padding:'4px 10px', fontSize:'0.85rem' }}
                      title="다음 곡"
                    >⏭</button>
                  )}
                </div>

                {/* 볼륨 슬라이더 */}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Mi size="sm" color="light">volume_down</Mi>
                  <input
                    type="range" min={0} max={100} value={volume}
                    onChange={e => handleVolume(Number(e.target.value))}
                    style={{ flex:1, accentColor:'var(--color-primary)', cursor:'pointer' }}
                  />
                  <Mi size="sm" color="light">volume_up</Mi>
                </div>

                {/* Seek Bar */}
                <div style={{ marginTop:6 }}>
                  <input
                    type="range" min={0} max={duration || 100} step={0.5}
                    value={currentTime}
                    onChange={e => handleSeek(Number(e.target.value))}
                    disabled={!ready || duration === 0}
                    style={{ width:'100%', accentColor:'var(--color-primary)', cursor: ready && duration > 0 ? 'pointer' : 'default' }}
                  />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem', color:'var(--color-text-light)', marginTop:1 }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* 플레이리스트 (2곡 이상일 때) */}
                {resolvedList.length > 1 && (
                  <div style={{ marginTop:8, maxHeight:130, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
                    {resolvedList.map((track, i) => {
                      const isActive = i === currentIndex
                      return (
                        <button key={i} onClick={() => playTrackAt(i)} style={{
                          width:'100%', display:'flex', alignItems:'center', gap:6,
                          padding:'4px 8px', border:'none', borderRadius:6,
                          background: isActive ? 'var(--color-primary)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--color-text)',
                          cursor:'pointer', fontSize:'0.73rem', textAlign:'left',
                          transition:'background 0.15s',
                        }}>
                          <span style={{ minWidth:14, fontSize:'0.62rem', color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--color-text-light)', flexShrink:0 }}>
                            {isActive && playing ? '▶' : i + 1}
                          </span>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                            {track.title || <span style={{ opacity:0.6 }}>(제목 없음)</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize:'0.78rem', color:'var(--color-text-light)', margin:'4px 0 8px' }}>
                BGM이 설정되지 않았어요
              </p>
            )}

            {/* 오너: 설정 버튼 */}
            {isOwner && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={openEdit}
                style={{ marginTop:8, width:'100%', fontSize:'0.73rem' }}
              >
                <Mi size="sm">settings</Mi> BGM 설정
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── BGM 설정 모달 ── */}
      {editing && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
          zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div style={{
            background:'var(--color-surface)', borderRadius:16, padding:'24px 24px 20px',
            maxWidth:460, width:'100%', maxHeight:'80vh',
            display:'flex', flexDirection:'column',
            boxShadow:'0 8px 40px rgba(0,0,0,0.25)',
          }}>
            {/* 모달 헤더 */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <h3 style={{ fontWeight:700, color:'var(--color-accent)', fontSize:'1rem', margin:0 }}>
                🎵 BGM 플레이리스트
              </h3>
              <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginLeft:'auto' }}>
                {editList.length} / {MAX_TRACKS}곡
              </span>
            </div>
            <p style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginBottom:14, marginTop:2 }}>
              유튜브 링크 또는 영상 ID 입력 · 순서대로 반복 재생
            </p>

            {/* 트랙 목록 */}
            <div style={{ overflowY:'auto', flex:1, marginBottom:14, display:'flex', flexDirection:'column', gap:6 }}>
              {editList.length === 0 ? (
                <p style={{ fontSize:'0.8rem', color:'var(--color-text-light)', textAlign:'center', padding:'16px 0', margin:0 }}>
                  아직 곡이 없어요
                </p>
              ) : editList.map((track, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display:'flex', alignItems:'center', gap:8,
                    background:'var(--color-nav-active-bg)', borderRadius:8, padding:'8px 10px',
                    cursor:'grab',
                    opacity: dragIdx.current === i ? 0.4 : 1,
                    borderTop: dragOverAt === i && dragIdx.current !== i
                      ? '2px solid var(--color-primary)'
                      : '2px solid transparent',
                    transition:'opacity 0.15s, border-top 0.1s',
                  }}
                >
                  {/* 드래그 핸들 */}
                  <span style={{ fontSize:'1rem', color:'var(--color-text-light)', flexShrink:0, lineHeight:1, userSelect:'none' }}>
                    ⠿
                  </span>
                  <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', minWidth:16, flexShrink:0 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.82rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {track.title || <span style={{ color:'var(--color-text-light)', fontWeight:400 }}>(제목 없음)</span>}
                    </div>
                    <div style={{ fontSize:'0.68rem', color:'var(--color-text-light)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {track.url}
                    </div>
                  </div>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => removeTrack(i)}
                    style={{
                      background:'none', border:'none', cursor:'pointer',
                      color:'#e57373', fontSize:'1.1rem', lineHeight:1,
                      padding:'0 2px', flexShrink:0,
                    }}
                  >×</button>
                </div>
              ))}
            </div>

            {/* 곡 추가 폼 */}
            {editList.length < MAX_TRACKS && (
              <div style={{ borderTop:'1px solid var(--color-border)', paddingTop:12, marginBottom:14 }}>
                <div style={{ fontSize:'0.77rem', fontWeight:600, color:'var(--color-text-light)', marginBottom:7 }}>
                  곡 추가
                </div>
                <input
                  className="form-input"
                  placeholder="YouTube URL 또는 영상 ID"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  style={{ fontSize:'0.83rem', marginBottom:6 }}
                />
                <div style={{ display:'flex', gap:6 }}>
                  <input
                    className="form-input"
                    placeholder="곡 제목 (선택)"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTrack() }}
                    style={{ flex:1, fontSize:'0.83rem' }}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={addTrack}
                    disabled={!newUrl.trim()}
                    style={{ flexShrink:0 }}
                  >
                    추가
                  </button>
                </div>
              </div>
            )}

            {/* 저장 / 취소 */}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ flex:1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
      {/* ── BGM 말풍선 ── */}
      <style>{`
        @keyframes bgmBubbleBounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-6px); }
        }
      `}</style>
      {showBubble && !expanded && (
        <div style={{
          position: 'fixed',
          bottom: 124,
          right: 62,
          zIndex: 10000,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '6px 12px',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--color-text)',
          boxShadow: '0 3px 14px rgba(0,0,0,0.13)',
          whiteSpace: 'nowrap',
          animation: 'bgmBubbleBounce 0.55s ease-in-out infinite alternate',
          pointerEvents: 'none',
        }}>
          🎵 재생 버튼을 눌러주세요
          {/* 오른쪽 방향 꼬리 (플레이어 버튼 쪽) */}
          <div style={{
            position: 'absolute',
            right: -7,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: '7px solid var(--color-surface)',
          }}/>
        </div>
      )}
    </>
  )
}
