// src/components/supporter/BgmPlayer.js
import React, { useState, useEffect, useRef } from 'react'
import { Mi } from '../Mi'

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
let _apiStatus = 'idle' // idle | loading | ready
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
  const videoId = extractVideoId(profile?.bgm_url)
  const hasVideo = !!videoId

  const playerRef     = useRef(null)
  const containerRef  = useRef(null)
  const [ready,   setReady]   = useState(false)
  const [playing, setPlaying] = useState(false)
  const [volume,  setVolume]  = useState(50)
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    url:      profile?.bgm_url      || '',
    title:    profile?.bgm_title    || '',
    autoplay: profile?.bgm_autoplay || false,
  })

  // form 동기화
  useEffect(() => {
    setForm({
      url:      profile?.bgm_url      || '',
      title:    profile?.bgm_title    || '',
      autoplay: profile?.bgm_autoplay || false,
    })
  }, [profile?.bgm_url, profile?.bgm_title, profile?.bgm_autoplay])

  // YouTube 플레이어 초기화
  useEffect(() => {
    if (!videoId || !containerRef.current) return
    setReady(false)
    setPlaying(false)

    loadYTApi(() => {
      if (!containerRef.current) return
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch {}
      }
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        height: '1',
        width:  '1',
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1,
          fs: 0, rel: 0, loop: 1, playlist: videoId,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume)
            setReady(true)
          },
          onStateChange: (e) => {
            if (!window.YT) return
            setPlaying(e.data === window.YT.PlayerState.PLAYING)
          },
        },
      })
    })

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch {}
        playerRef.current = null
      }
      setReady(false)
      setPlaying(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  const togglePlay = () => {
    if (!playerRef.current) return
    if (playing) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }

  const handleVolume = (v) => {
    setVolume(v)
    if (playerRef.current?.setVolume) playerRef.current.setVolume(v)
  }

  const saveSettings = async () => {
    setSaving(true)
    await onSave({ bgm_url: form.url.trim(), bgm_title: form.title.trim(), bgm_autoplay: form.autoplay })
    setSaving(false)
    setEditing(false)
  }

  // 데이터도 없고 오너도 아니면 렌더링 안 함
  if (!hasVideo && !isOwner) return null

  const displayTitle = (profile?.bgm_title || 'BGM').slice(0, 22)

  return (
    <>
      {/* 숨겨진 플레이어 컨테이너 */}
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0, pointerEvents:'none' }}>
        <div ref={containerRef}/>
      </div>

      {/* 플레이어 위젯 (fixed, 다크 토글 위) */}
      <div style={{
        position:'fixed', bottom:116, right:20, zIndex:9999,
        background:'var(--color-surface)',
        border:'1px solid var(--color-border)',
        borderRadius: expanded ? 16 : 100,
        boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
        backdropFilter:'blur(12px)',
        overflow:'hidden',
        transition:'border-radius 0.2s',
        minWidth: expanded ? 220 : 36,
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
          <div style={{ padding:'10px 14px', minWidth:220 }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <Mi size="sm" color="accent">music_note</Mi>
              <span style={{ fontSize:'0.8rem', fontWeight:700, flex:1, color:'var(--color-accent)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {displayTitle}
              </span>
              <button onClick={() => setExpanded(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-light)', fontSize:'1rem', lineHeight:1, padding:'0 2px' }}>
                ×
              </button>
            </div>

            {hasVideo ? (
              <>
                {/* 재생 버튼 */}
                <button
                  className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-primary'}`}
                  onClick={togglePlay}
                  disabled={!ready}
                  style={{ width:'100%', fontSize:'0.78rem', marginBottom:8 }}
                >
                  {!ready ? '로딩 중...' : playing ? '⏸ 일시정지' : '▶ 재생'}
                </button>

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
                onClick={() => setEditing(true)}
                style={{ marginTop:8, width:'100%', fontSize:'0.73rem' }}
              >
                <Mi size="sm">settings</Mi> BGM 설정
              </button>
            )}
          </div>
        )}
      </div>

      {/* BGM 설정 모달 */}
      {editing && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
          zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div style={{
            background:'var(--color-surface)', borderRadius:16, padding:'24px 24px 20px',
            maxWidth:420, width:'100%',
            boxShadow:'0 8px 40px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ fontWeight:700, color:'var(--color-accent)', marginBottom:18, fontSize:'1rem' }}>
              🎵 BGM 설정
            </h3>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginBottom:5 }}>YouTube URL</label>
              <input
                className="form-input"
                placeholder="https://www.youtube.com/watch?v=..."
                value={form.url}
                onChange={e => setForm(f => ({...f, url: e.target.value}))}
                style={{ fontSize:'0.85rem' }}
              />
              <p style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginTop:4 }}>
                유튜브 링크 또는 영상 ID를 입력하세요 (공식 임베드 API 사용)
              </p>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginBottom:5 }}>곡 제목</label>
              <input
                className="form-input"
                placeholder="방문자에게 표시될 곡 이름"
                value={form.title}
                onChange={e => setForm(f => ({...f, title: e.target.value}))}
                style={{ fontSize:'0.85rem' }}
              />
            </div>

            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ flex:1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
