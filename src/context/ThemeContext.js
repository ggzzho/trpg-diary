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

export function applyTheme(primary, bg, accent) {
  const root = document.documentElement
  const [pr, pg, pb] = hexToRgb(primary)
  const [ar, ag, ab] = hexToRgb(accent)
  const [br, bgG, bb] = hexToRgb(bg)

  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-bg', bg)
  root.style.setProperty('--color-accent', accent)
  root.style.setProperty('--color-border', `rgba(${pr}, ${pg}, ${pb}, 0.3)`)
  root.style.setProperty('--color-shadow', `rgba(${ar}, ${ag}, ${ab}, 0.08)`)
  root.style.setProperty('--color-surface',
    `rgba(${Math.min(255,br+10)}, ${Math.min(255,bgG+8)}, ${Math.min(255,bb+5)}, 0.92)`)
  root.style.setProperty('--color-nav-active-bg', `rgba(${pr}, ${pg}, ${pb}, 0.12)`)
  root.style.setProperty('--color-btn-shadow', `rgba(${pr}, ${pg}, ${pb}, 0.35)`)
  root.style.setProperty('--color-text',
    `rgb(${Math.max(0,ar-30)}, ${Math.max(0,ag-20)}, ${Math.max(0,ab-10)})`)
  root.style.setProperty('--color-text-light',
    `rgb(${Math.min(180,ar+30)}, ${Math.min(160,ag+20)}, ${Math.min(140,ab+20)})`)
  document.body.style.backgroundColor = bg

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
export function applyBackground(imageUrl, opacity = 1) {
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

  // 반투명 오버레이로 불투명도 조절 (흰색 오버레이로 배경을 흐리게)
  const overlay = document.createElement('div')
  overlay.id = 'bg-overlay'
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: white;
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
    if (!profile) return
    applyTheme(
      profile.theme_color || '#c8a96e',
      profile.theme_bg_color || '#faf6f0',
      profile.theme_accent || '#8b6f47'
    )
    applyBackground(
      profile.background_image_url || '',
      profile.bg_opacity !== undefined ? profile.bg_opacity : 1
    )
  }, [profile])

  return <ThemeContext.Provider value={{ profile }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
