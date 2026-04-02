// src/context/ThemeContext.js
import React, { createContext, useContext, useEffect } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

// hex → [r, g, b]
function hexToRgb(hex) {
  if (!hex || hex.length < 7) return [200, 169, 110]
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b]
  } catch {
    return [200, 169, 110]
  }
}

// 테마 색상을 모든 CSS 변수에 한번에 적용
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
    `rgba(${Math.min(255, br + 10)}, ${Math.min(255, bgG + 8)}, ${Math.min(255, bb + 5)}, 0.92)`)
  root.style.setProperty('--color-nav-active-bg', `rgba(${pr}, ${pg}, ${pb}, 0.12)`)
  root.style.setProperty('--color-btn-shadow', `rgba(${pr}, ${pg}, ${pb}, 0.35)`)
  root.style.setProperty('--color-text',
    `rgb(${Math.max(0, ar - 30)}, ${Math.max(0, ag - 20)}, ${Math.max(0, ab - 10)})`)
  root.style.setProperty('--color-text-light',
    `rgb(${Math.min(180, ar + 30)}, ${Math.min(160, ag + 20)}, ${Math.min(140, ab + 20)})`)

  document.body.style.backgroundColor = bg
}

export function ThemeProvider({ children, overrideProfile }) {
  const { profile: authProfile } = useAuth()
  const profile = overrideProfile || authProfile

  useEffect(() => {
    if (!profile) return

    const primary = profile.theme_color || '#c8a96e'
    const bg = profile.theme_bg_color || '#faf6f0'
    const accent = profile.theme_accent || '#8b6f47'

    applyTheme(primary, bg, accent)

    // 배경 이미지
    if (profile.background_image_url) {
      document.body.style.backgroundImage = `url(${profile.background_image_url})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundAttachment = 'fixed'
    } else {
      document.body.style.backgroundImage = ''
    }
  }, [profile])

  return <ThemeContext.Provider value={{ profile }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
