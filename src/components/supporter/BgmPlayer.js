// src/components/supporter/BgmPlayer.js
import React, { useState, useEffect, useRef } from 'react'
import { Mi } from '../Mi'

const MAX_TRACKS = 8

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

// YouTube oEmbed로 영상 제목 자동 fetch
const fetchYouTubeTitle = async (url) => {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.title || null
  } catch {
    return null
  }
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
  const videoIds  = resolvedList.map(t => extractVideoId(t.url)).filter(Boolean)
  const hasVideo  = videoIds.length > 0

  // ── 플레이어 refs ──
  const playerRef    = useRef(null)
  const containerRef = useRef(null)

  // ── 플레이어 상태 ──
  const [ready,        setReady]        = useState(false)
  const [playing,      setPlaying]      = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // ── Seek 상태 ──
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const seekIntervalRef = useRef(null)

  // ── UI 상태 ──
  const [collapsed,    setCollapsed]    = useState(() => window.innerWidth < 600)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [saving,       setSaving]       = useState(false)

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

  // ── 오너 편집 상태 ──
  const [editList,      setEditList]      = useState([])
  const [hasChanges,    setHasChanges]    = useState(false)
  const [newUrl,        setNewUrl]        = useState('')
  const [newTitle,      setNewTitle]      = useState('')
  const [fetchingTitle, setFetchingTitle] = useState(false)

  // 햄버거 패널 열릴 때 editList 초기화 (오너)
  useEffect(() => {
    if (showPlaylist && isOwner) {
      setEditList(resolvedList.map(t => ({ ...t })))
      setHasChanges(false)
      setNewUrl('')
      setNewTitle('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlaylist])

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
            e.target.setVolume(50)
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

  // ── Seek 폴링 ──
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
  const togglePlay  = () => {
    if (!playerRef.current) return
    playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo()
  }
  const handlePrev  = () => { try { playerRef.current?.previousVideo() } catch {} }
  const handleNext  = () => { try { playerRef.current?.nextVideo()     } catch {} }
  const handleSeek  = (v) => {
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

  // ── 오너 편집 ──
  const moveTrack = (i, dir) => {
    const list = [...editList]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setEditList(list)
    setHasChanges(true)
  }
  const removeTrack = (i) => {
    setEditList(prev => prev.filter((_, idx) => idx !== i))
    setHasChanges(true)
  }
  const addTrack = async () => {
    const url = newUrl.trim()
    if (!url || editList.length >= MAX_TRACKS) return
    let title = newTitle.trim()
    if (!title) {
      setFetchingTitle(true)
      title = await fetchYouTubeTitle(url) || ''
      setFetchingTitle(false)
    }
    setEditList(prev => [...prev, { url, title }])
    setHasChanges(true)
    setNewUrl('')
    setNewTitle('')
  }
  const saveSettings = async () => {
    setSaving(true)
    await onSave({ bgm_playlist: editList, bgm_autoplay: false })
    setSaving(false)
    setHasChanges(false)
  }
  const cancelEdit = () => {
    setEditList(resolvedList.map(t => ({ ...t })))
    setHasChanges(false)
    setNewUrl('')
    setNewTitle('')
  }

  // 데이터 없고 오너도 아님 → 렌더링 안 함
  if (!hasVideo && !isOwner) return null

  const currentTrack = resolvedList[currentIndex] || resolvedList[0]
  const displayTitle = (currentTrack?.title || 'BGM').slice(0, 24)
  const multiTrack   = resolvedList.length > 1

  return (
    <>
      {/* 숨겨진 YouTube 플레이어 컨테이너 */}
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0, pointerEvents:'none' }}>
        <div ref={containerRef} />
      </div>

      {/* ── 플로팅 위젯 ── */}
      {collapsed ? (
        /* ── 접힌 상태: 미니 원형 버튼 ── */
        <div style={{ position:'fixed', bottom:164, right:20, zIndex:9998 }}>
          <button
            onClick={() => setCollapsed(false)}
            style={{
              width:36, height:36, borderRadius:'50%',
              background:'var(--color-surface)',
              border:'1px solid var(--color-border)',
              boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
              backdropFilter:'blur(12px)',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer',
              color: playing ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
            title="BGM 플레이어 열기"
          >
            <Mi size="sm">music_note</Mi>
          </button>
          {playing && (
            <span style={{
              position:'absolute', top:4, right:4,
              width:8, height:8, borderRadius:'50%',
              background:'var(--color-primary)',
              pointerEvents:'none',
            }}/>
          )}
        </div>
      ) : (
      <div style={{
        position:'fixed', bottom:164, right:20, zIndex:9998,
        width:284,
        background:'var(--color-surface)',
        border:'1px solid var(--color-border)',
        borderRadius:14,
        boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
        backdropFilter:'blur(12px)',
        overflow:'hidden',
      }}>

        {/* ── 3행 컨트롤 영역 ── */}
        <div style={{ padding:'10px 14px 8px' }}>

          {/* 행①: 음표 + 곡명 + 시간 + 접기 버튼 */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
            <Mi size="sm" style={{
              color: playing ? 'var(--color-primary)' : 'var(--color-text-light)',
              flexShrink:0, transition:'color 0.2s',
            }}>music_note</Mi>
            <span style={{
              fontSize:'0.82rem', fontWeight:600, color:'var(--color-accent)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              flex:1, minWidth:0,
            }}>
              {hasVideo ? displayTitle : 'BGM 없음'}
            </span>
            <span style={{ fontSize:'0.65rem', color:'var(--color-text-light)', flexShrink:0, whiteSpace:'nowrap' }}>
              {hasVideo ? `${formatTime(currentTime)} / ${formatTime(duration)}` : ''}
            </span>
            <button
              onClick={() => { setCollapsed(true); setShowPlaylist(false) }}
              style={{
                background:'none', border:'none', cursor:'pointer',
                color:'var(--color-text-light)', fontSize:'1rem', lineHeight:1,
                padding:'0 2px', flexShrink:0, opacity:0.6,
              }}
              title="접기"
            >─</button>
          </div>

          {/* 행②: Seek 바 */}
          <input
            type="range" min={0} max={duration || 100} step={0.5}
            value={currentTime}
            onChange={e => handleSeek(Number(e.target.value))}
            disabled={!ready || !hasVideo || duration === 0}
            style={{
              width:'100%', display:'block', marginBottom:6,
              accentColor:'var(--color-primary)',
              cursor: ready && hasVideo && duration > 0 ? 'pointer' : 'default',
            }}
          />

          {/* 행③: 햄버거 + 카운터 | 이전·재생·다음 */}
          <div style={{ display:'flex', alignItems:'center' }}>

            {/* 좌측: 햄버거 + 트랙 카운터 */}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              {(multiTrack || isOwner) && (
                <button
                  onClick={() => setShowPlaylist(v => !v)}
                  style={{
                    background:'none', border:'none', cursor:'pointer', padding:'2px 3px',
                    color: showPlaylist ? 'var(--color-primary)' : 'var(--color-text-light)',
                    display:'flex', alignItems:'center',
                  }}
                  title="플레이리스트"
                >
                  <Mi size="sm">menu</Mi>
                </button>
              )}
              {multiTrack && (
                <span style={{ fontSize:'0.7rem', color:'var(--color-text-light)' }}>
                  {currentIndex + 1}/{resolvedList.length}
                </span>
              )}
            </div>

            {/* 우측: 재생 컨트롤 */}
            <div style={{ display:'flex', alignItems:'center', gap:3, marginLeft:'auto' }}>
              <button
                onClick={handlePrev} disabled={!ready || !multiTrack}
                style={{
                  background:'none', border:'none', padding:'3px 5px',
                  cursor: ready && multiTrack ? 'pointer' : 'default',
                  color:'var(--color-text)', fontSize:'0.8rem',
                  opacity: ready && multiTrack ? 1 : 0.3,
                }}
                title="이전 곡"
              >⏮</button>

              <button
                onClick={togglePlay} disabled={!ready || !hasVideo}
                style={{
                  background:'var(--color-primary)', border:'none', borderRadius:6,
                  color:'#fff', padding:'5px 14px', fontSize:'0.78rem', fontWeight:700,
                  cursor: ready && hasVideo ? 'pointer' : 'default',
                  opacity: ready && hasVideo ? 1 : 0.55,
                  minWidth:66,
                }}
              >
                {!ready ? '로딩 중' : playing ? '■ 정지' : '▶ 재생'}
              </button>

              <button
                onClick={handleNext} disabled={!ready || !multiTrack}
                style={{
                  background:'none', border:'none', padding:'3px 5px',
                  cursor: ready && multiTrack ? 'pointer' : 'default',
                  color:'var(--color-text)', fontSize:'0.8rem',
                  opacity: ready && multiTrack ? 1 : 0.3,
                }}
                title="다음 곡"
              >⏭</button>
            </div>
          </div>
        </div>

        {/* ── 햄버거 패널 ── */}
        {showPlaylist && (
          <div style={{ borderTop:'1px solid var(--color-border)' }}>

            {/* 패널 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px 5px' }}>
              <span style={{ fontSize:'0.77rem', fontWeight:700, color:'var(--color-accent)' }}>
                BGM 플레이리스트
              </span>
              <span style={{ fontSize:'0.67rem', color:'var(--color-text-light)' }}>
                {isOwner
                  ? `${editList.length}/${MAX_TRACKS}곡`
                  : `${resolvedList.length}곡`
                }
              </span>
            </div>

            {/* 트랙 목록 */}
            <div style={{ maxHeight:200, overflowY:'auto', padding:'0 14px 4px' }}>
              {(isOwner ? editList : resolvedList).length === 0 ? (
                <p style={{ fontSize:'0.78rem', color:'var(--color-text-light)', textAlign:'center', padding:'12px 0', margin:0 }}>
                  아직 곡이 없어요
                </p>
              ) : (isOwner ? editList : resolvedList).map((track, i) => {
                const isActive = i === currentIndex
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:4,
                    padding:'5px 0',
                    borderBottom:'1px solid var(--color-border)',
                  }}>
                    {/* 번호 + 제목 클릭 → 재생 */}
                    <button
                      onClick={() => playTrackAt(i)}
                      style={{
                        flex:1, display:'flex', alignItems:'center', gap:6,
                        background:'none', border:'none', cursor:'pointer',
                        textAlign:'left', padding:0, minWidth:0,
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                      }}
                    >
                      <span style={{
                        fontSize:'0.63rem', flexShrink:0, minWidth:14,
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-light)',
                        fontWeight: isActive ? 700 : 400,
                      }}>
                        {isActive && playing ? '▶' : i + 1}
                      </span>
                      <span style={{
                        fontSize:'0.78rem', fontWeight: isActive ? 700 : 400,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      }}>
                        {track.title || <span style={{ opacity:0.5, fontStyle:'italic' }}>제목 없음</span>}
                      </span>
                    </button>

                    {/* 오너: ▲ ▼ × */}
                    {isOwner && (
                      <div style={{ display:'flex', alignItems:'center', gap:1, flexShrink:0 }}>
                        <button
                          onClick={() => moveTrack(i, -1)} disabled={i === 0}
                          style={{ background:'none', border:'none', cursor: i > 0 ? 'pointer' : 'default', color:'var(--color-text-light)', fontSize:'0.6rem', padding:'2px 3px', opacity: i > 0 ? 1 : 0.25, lineHeight:1 }}
                          title="위로"
                        >▲</button>
                        <button
                          onClick={() => moveTrack(i, 1)} disabled={i === editList.length - 1}
                          style={{ background:'none', border:'none', cursor: i < editList.length - 1 ? 'pointer' : 'default', color:'var(--color-text-light)', fontSize:'0.6rem', padding:'2px 3px', opacity: i < editList.length - 1 ? 1 : 0.25, lineHeight:1 }}
                          title="아래로"
                        >▼</button>
                        <button
                          onClick={() => removeTrack(i)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#e57373', fontSize:'0.85rem', padding:'2px 3px', lineHeight:1 }}
                          title="삭제"
                        >×</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 곡 추가 (오너 + 여유 슬롯 있을 때) */}
            {isOwner && editList.length < MAX_TRACKS && (
              <div style={{ padding:'10px 14px 6px', borderTop:'1px solid var(--color-border)' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--color-text-light)', marginBottom:6 }}>
                  곡 추가
                </div>
                <input
                  className="form-input"
                  placeholder="YouTube URL 또는 영상 ID"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  style={{ fontSize:'0.78rem', marginBottom:5 }}
                />
                <div style={{ display:'flex', gap:5 }}>
                  <input
                    className="form-input"
                    placeholder={fetchingTitle ? '제목 불러오는 중...' : '곡 제목 (미입력시 유튜브 제목 자동 로드)'}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTrack() }}
                    style={{ flex:1, fontSize:'0.73rem' }}
                    disabled={fetchingTitle}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={addTrack}
                    disabled={!newUrl.trim() || fetchingTitle}
                    style={{ flexShrink:0, fontWeight:700, minWidth:30 }}
                    title="추가"
                  >+</button>
                </div>
              </div>
            )}

            {/* 저장 / 취소 (오너 전용) */}
            {isOwner && (
              <div style={{ display:'flex', gap:6, padding:'8px 14px 12px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveSettings}
                  disabled={saving || !hasChanges}
                  style={{ flex:1, fontSize:'0.78rem' }}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={cancelEdit}
                  disabled={saving || !hasChanges}
                  style={{ fontSize:'0.78rem' }}
                >
                  취소
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )} {/* collapsed 삼항 끝 */}

      {/* ── BGM 말풍선 (첫 방문 1회) ── */}
      <style>{`
        @keyframes bgmBubbleBounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-6px); }
        }
      `}</style>
      {showBubble && collapsed && (
        <div style={{
          position:'fixed', bottom:182, right:62, zIndex:10000,
          background:'var(--color-surface)',
          border:'1px solid var(--color-border)',
          borderRadius:10,
          padding:'6px 12px',
          fontSize:'0.78rem', fontWeight:600, color:'var(--color-text)',
          boxShadow:'0 3px 14px rgba(0,0,0,0.13)',
          whiteSpace:'nowrap',
          animation:'bgmBubbleBounce 0.55s ease-in-out infinite alternate',
          pointerEvents:'none',
        }}>
          🎵 재생 버튼을 눌러주세요
          {/* 오른쪽 꼬리 */}
          <div style={{
            position:'absolute', right:-7, top:'50%', transform:'translateY(-50%)',
            width:0, height:0,
            borderTop:'6px solid transparent', borderBottom:'6px solid transparent',
            borderLeft:'7px solid var(--color-surface)',
          }}/>
        </div>
      )}
    </>
  )
}
