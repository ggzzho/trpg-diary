// src/context/ThemeContext.js
import React, { createContext, useContext, useEffect } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return [200, 169, 110]
  try {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
  } catch { return [200, 169, 110] }
}

export function applyTheme(primary, bg, accent, textColor = null, darkMode = false) {
  const root = document.documentElement
  const [pr, pg, pb] = hexToRgb(primary)
  const [ar, ag, ab] = hexToRgb(accent)

  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-accent', accent)
  root.style.setProperty('--color-shadow', `rgba(${ar}, ${ag}, ${ab}, 0.08)`)
  root.style.setProperty('--color-nav-active-bg', `rgba(${pr}, ${pg}, ${pb}, 0.12)`)
  root.style.setProperty('--color-btn-shadow', `rgba(${pr}, ${pg}, ${pb}, 0.35)`)

  if (darkMode) {
    const bgR = Math.max(18, Math.round(pr * 0.11))
    const bgG = Math.max(18, Math.round(pg * 0.11))
    const bgB = Math.max(18, Math.round(pb * 0.11))
    const sfR = Math.max(30, Math.round(pr * 0.17))
    const sfG = Math.max(30, Math.round(pg * 0.17))
    const sfB = Math.max(30, Math.round(pb * 0.17))
    const darkBg = `rgb(${bgR},${bgG},${bgB})`
    root.style.setProperty('--color-bg', darkBg)
    root.style.setProperty('--color-surface', `rgba(${sfR},${sfG},${sfB},0.97)`)
    root.style.setProperty('--color-border', `rgba(${pr}, ${pg}, ${pb}, 0.22)`)
    root.style.setProperty('--color-text', textColor || `rgb(${Math.min(245,ar+110)}, ${Math.min(245,ag+110)}, ${Math.min(245,ab+110)})`)
    root.style.setProperty('--color-text-light', `rgb(${Math.min(185,ar+55)}, ${Math.min(185,ag+55)}, ${Math.min(185,ab+55)})`)
    document.body.style.backgroundColor = darkBg
  } else {
    const [br, bgG, bb] = hexToRgb(bg)
    root.style.setProperty('--color-bg', bg)
    root.style.setProperty('--color-border', `rgba(${pr}, ${pg}, ${pb}, 0.3)`)
    root.style.setProperty('--color-surface',
      `rgba(${Math.min(255,br+10)}, ${Math.min(255,bgG+8)}, ${Math.min(255,bb+5)}, 0.92)`)
    root.style.setProperty('--color-text',
      textColor || `rgb(${Math.max(0,ar-30)}, ${Math.max(0,ag-20)}, ${Math.max(0,ab-10)})`)
    root.style.setProperty('--color-text-light',
      `rgb(${Math.min(180,ar+30)}, ${Math.min(160,ag+20)}, ${Math.min(140,ab+20)})`)
    document.body.style.backgroundColor = bg
  }

  // 동적 파비콘 - 테마 컬러로 ✦ 심벌 생성
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32; canvas.height = 32
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = primary
    ctx.font = 'bold 22px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✦', 16, 17)
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
    link.type = 'image/x-icon'
    link.rel = 'shortcut icon'
    link.href = canvas.toDataURL()
    document.head.appendChild(link)
  } catch(e) { /* 파비콘 생성 실패 시 무시 */ }
}

// 배경 이미지 + 불투명도 적용
export function applyBackground(imageUrl, opacity = 1, darkMode = false, primary = '#c8a96e') {
  // 기존 오버레이 제거
  const existing = document.getElementById('bg-overlay')
  if (existing) existing.remove()

  if (!imageUrl) {
    document.body.style.backgroundImage = ''
    return
  }

  // body에 배경 이미지 설정
  document.body.style.backgroundImage = `url(${imageUrl})`
  document.body.style.backgroundSize = 'cover'
  document.body.style.backgroundAttachment = 'fixed'
  document.body.style.backgroundPosition = 'center'

  // 오버레이 컬러: 다크모드는 primary 기반 어두운 tint, 라이트는 흰색
  let overlayColor = 'white'
  if (darkMode) {
    const [pr, pg, pb] = hexToRgb(primary)
    const bgR = Math.max(18, Math.round(pr * 0.11))
    const bgG = Math.max(18, Math.round(pg * 0.11))
    const bgB = Math.max(18, Math.round(pb * 0.11))
    overlayColor = `rgb(${bgR},${bgG},${bgB})`
  }

  const overlay = document.createElement('div')
  overlay.id = 'bg-overlay'
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: ${overlayColor};
    opacity: ${1 - opacity};
    pointer-events: none;
    z-index: 0;
  `
  document.body.appendChild(overlay)
}

export function ThemeProvider({ children, overrideProfile }) {
  const { profile: authProfile } = useAuth()
  const profile = overrideProfile || authProfile

  useEffect(() => {
    if (!profile) {
      // 로그인 화면 등 프로필 미로드 시 기본 파비콘만 적용
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 32; canvas.height = 32
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#faf6f0'
        ctx.fillRect(0, 0, 32, 32)
        ctx.fillStyle = '#c8a96e'
        ctx.font = 'bold 22px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✦', 16, 17)
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
        link.type = 'image/x-icon'
        link.rel = 'shortcut icon'
        link.href = canvas.toDataURL()
        document.head.appendChild(link)
      } catch(e) {}
      return
    }
    applyTheme(
      profile.theme_color || '#c8a96e',
      profile.theme_bg_color || '#faf6f0',
      profile.theme_accent || '#8b6f47',
      profile.theme_text_color || null,
      profile.dark_mode || false
    )
    applyBackground(
      profile.background_image_url || '',
      profile.bg_opacity !== undefined ? profile.bg_opacity : 1,
      profile.dark_mode || false,
      profile.theme_color || '#c8a96e'
    )
  }, [profile])

  return <ThemeContext.Provider value={{ profile }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
