// src/components/CursorEffect.js
import { useEffect, useRef } from 'react'

const CURSOR_URLS = {
  dice: 'https://djkvpbduugrhfhtrqmxu.supabase.co/storage/v1/object/public/cursors/dice_cursor.png',
  wand: 'https://djkvpbduugrhfhtrqmxu.supabase.co/storage/v1/object/public/cursors/magic_cursor.png',
  pen:  'https://djkvpbduugrhfhtrqmxu.supabase.co/storage/v1/object/public/cursors/pen_cursor.png',
}

const TRAIL_CHARS = {
  sparkle: ['✨', '✦', '✧', '⋆', '·', '✩'],
  star:    ['⭐', '★', '✦', '✩', '⭑', '✬'],
  heart:   ['💜', '💗', '♥', '🩷', '💖', '❤'],
}

const CLICK_COLORS = ['#ff6b9d', '#c44dff', '#4d88ff', '#ffcc00', '#ff8844', '#44ffcc', '#ff6644']

const KEYFRAMES = `
  @keyframes _ceTrail {
    0%   { opacity: 1; transform: scale(1) translateY(0) rotate(var(--r)); }
    100% { opacity: 0; transform: scale(0.2) translateY(-22px) rotate(var(--r)); }
  }
  @keyframes _ceRipple {
    0%   { transform: scale(0.3); opacity: 0.9; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes _ceParticle {
    0%   { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
  }
`

// Web Audio API 클릭 사운드 — 딸깍
const playClickSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // suspended 상태 해제 (브라우저 자동 정책)
    ctx.resume().then(() => {
      const sr      = ctx.sampleRate
      const bufSize = Math.floor(sr * 0.028) // 28ms
      const buffer  = ctx.createBuffer(1, bufSize, sr)
      const data    = buffer.getChannelData(0)

      // 지수 감쇠 화이트 노이즈
      for (let i = 0; i < bufSize; i++) {
        const decay = Math.pow(1 - i / bufSize, 3)
        data[i] = (Math.random() * 2 - 1) * decay
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer

      // 하이패스 1kHz: 저주파 웅웅거림 제거, 딸깍 질감 보존
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1000

      const gain = ctx.createGain()
      gain.gain.value = 3.5

      source.connect(hp)
      hp.connect(gain)
      gain.connect(ctx.destination)
      source.start()
      source.onended = () => ctx.close()
    })
  } catch {}
}

export default function CursorEffect({ settings }) {
  const cursorElRef  = useRef(null)
  const containerRef = useRef(null)
  const styleElRef   = useRef(null)
  const lastTrailRef = useRef(0)
  const lastPosRef   = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // 터치 디바이스 비활성화
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return
    if (!settings) return

    const {
      cursor = { type: 'default' },
      trail  = { enabled: false, type: 'sparkle' },
      click  = { enabled: false, type: 'ripple' },
      sound  = { enabled: false },
    } = settings

    const hasCursor = cursor.type !== 'default'
    const cursorUrl = cursor.type === 'custom' ? cursor.url : CURSOR_URLS[cursor.type]

    // ── 스타일 삽입 ──
    const styleEl = document.createElement('style')
    styleEl.textContent = KEYFRAMES
    document.head.appendChild(styleEl)
    styleElRef.current = styleEl

    // ── 파티클 컨테이너 ──
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99997;overflow:hidden;'
    document.body.appendChild(container)
    containerRef.current = container

    // ── 커스텀 커서 이미지 ──
    if (hasCursor && cursorUrl) {
      document.body.style.cursor = 'none'
      const img = document.createElement('img')
      img.src = cursorUrl
      img.alt = ''
      img.draggable = false
      img.style.cssText = `
        position:fixed; top:0; left:0;
        width:32px; height:32px;
        pointer-events:none; z-index:99999;
        transform:translate(-2px,-2px);
        user-select:none; image-rendering:pixelated;
        display:none;
      `
      document.body.appendChild(img)
      cursorElRef.current = img
    }

    // ── 트레일 파티클 생성 ──
    const spawnTrail = (x, y) => {
      if (!trail.enabled) return
      const chars = TRAIL_CHARS[trail.type] || TRAIL_CHARS.sparkle
      const char = chars[Math.floor(Math.random() * chars.length)]
      const el = document.createElement('span')
      const rot = Math.floor(Math.random() * 360)
      el.textContent = char
      el.style.cssText = `
        position:fixed;
        left:${x - 10}px; top:${y - 10}px;
        font-size:${11 + Math.random() * 9}px;
        pointer-events:none; z-index:99998;
        animation:_ceTrail 0.65s ease forwards;
        --r:${rot}deg;
        user-select:none;
      `
      container.appendChild(el)
      setTimeout(() => el.remove(), 700)
    }

    // ── 클릭 이펙트 생성 ──
    const spawnClick = (x, y) => {
      if (!click.enabled) return

      if (click.type === 'ripple') {
        const el = document.createElement('div')
        el.style.cssText = `
          position:fixed;
          left:${x - 18}px; top:${y - 18}px;
          width:36px; height:36px;
          border-radius:50%;
          border:2px solid var(--color-primary, #c8a96e);
          pointer-events:none; z-index:99998;
          animation:_ceRipple 0.5s ease forwards;
        `
        container.appendChild(el)
        setTimeout(() => el.remove(), 520)
      } else {
        // 파티클 버스트
        const count = 8
        for (let i = 0; i < count; i++) {
          const el = document.createElement('div')
          const angle = (i / count) * Math.PI * 2
          const dist = 28 + Math.random() * 22
          const color = CLICK_COLORS[Math.floor(Math.random() * CLICK_COLORS.length)]
          el.style.cssText = `
            position:fixed;
            left:${x - 4}px; top:${y - 4}px;
            width:8px; height:8px;
            border-radius:50%;
            background:${color};
            pointer-events:none; z-index:99998;
            animation:_ceParticle 0.5s ease forwards;
            --dx:${(Math.cos(angle) * dist).toFixed(1)}px;
            --dy:${(Math.sin(angle) * dist).toFixed(1)}px;
          `
          container.appendChild(el)
          setTimeout(() => el.remove(), 520)
        }
      }
    }

    // ── mousemove ──
    const handleMouseMove = (e) => {
      const x = e.clientX
      const y = e.clientY

      if (cursorElRef.current) {
        cursorElRef.current.style.display = 'block'
        cursorElRef.current.style.left = `${x}px`
        cursorElRef.current.style.top  = `${y}px`
      }

      const now = Date.now()
      const dx = x - lastPosRef.current.x
      const dy = y - lastPosRef.current.y
      const moved = Math.sqrt(dx * dx + dy * dy)
      if (now - lastTrailRef.current > 55 && moved > 14) {
        lastTrailRef.current = now
        lastPosRef.current = { x, y }
        spawnTrail(x, y)
      }
    }

    // ── click ──
    const handleClick = (e) => {
      spawnClick(e.clientX, e.clientY)
      if (sound.enabled) playClickSound()
    }

    // ── mouseleave (커서 숨기기) ──
    const handleMouseLeave = () => {
      if (cursorElRef.current) cursorElRef.current.style.display = 'none'
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('click', handleClick)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.body.style.cursor = ''
      cursorElRef.current?.remove()
      cursorElRef.current = null
      containerRef.current?.remove()
      containerRef.current = null
      styleElRef.current?.remove()
      styleElRef.current = null
    }
  }, [settings])

  return null
}
