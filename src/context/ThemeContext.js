// src/context/ThemeContext.js
import React, { createContext, useContext, useEffect } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

export function ThemeProvider({ children, overrideProfile }) {
  const { profile: authProfile } = useAuth()
  const profile = overrideProfile || authProfile

  useEffect(() => {
    if (!profile) return
    const root = document.documentElement
    root.style.setProperty('--color-primary', profile.theme_color || '#c8a96e')
    root.style.setProperty('--color-bg', profile.theme_bg_color || '#faf6f0')
    root.style.setProperty('--color-accent', profile.theme_accent || '#8b6f47')
    
    const body = document.body
    if (profile.background_image_url) {
      body.style.backgroundImage = `url(${profile.background_image_url})`
      body.style.backgroundSize = 'cover'
      body.style.backgroundAttachment = 'fixed'
    } else {
      body.style.backgroundImage = ''
    }
  }, [profile])

  return <ThemeContext.Provider value={{ profile }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
