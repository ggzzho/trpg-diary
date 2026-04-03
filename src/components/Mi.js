// src/components/Mi.js - Material Icons 헬퍼 컴포넌트
import React from 'react'

/**
 * Mi - Material Symbols Rounded 아이콘
 * @param {string} children - 아이콘 이름 (e.g. "home", "calendar_month")
 * @param {string} size - "sm"|"md"|"lg" (기본 md)
 * @param {string} color - CSS 색상 또는 "accent"|"light"|"white"|"danger"
 * @param {boolean} filled - fill 스타일 여부
 */
export function Mi({ children, size, color, filled, style, ...props }) {
  const sz = size === 'sm' ? 16 : size === 'lg' ? 24 : 20
  const col = color === 'accent' ? 'var(--color-accent)'
    : color === 'light' ? 'var(--color-text-light)'
    : color === 'white' ? 'white'
    : color === 'danger' ? '#e57373'
    : color === 'primary' ? 'var(--color-primary)'
    : color || 'var(--color-accent)'
  return (
    <span
      className="ms"
      style={{
        fontSize: sz,
        color: col,
        fontVariationSettings: `'FILL' ${filled?1:0}, 'wght' 300, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  )
}
