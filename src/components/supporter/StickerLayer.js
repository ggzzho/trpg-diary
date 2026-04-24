// src/components/supporter/StickerLayer.js
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mi } from '../Mi'

const MAX_STICKERS    = 10
const REFERENCE_WIDTH = 860   // 기준 컨테이너 너비 (maxWidth:860)
const genId = () => `s${Date.now()}${Math.random().toString(36).slice(2, 7)}`

// 스티커 x 최대값: size 기준으로 우측 overflow 방지
const calcMaxX = (size) => Math.max(0, (1 - size / REFERENCE_WIDTH) * 100)

// ── 단일 스티커 ──────────────────────────────────────
function StickerItem({
  sticker, isEditMode, isSelected,
  onSelect, onUpdate, onRemove,
  containerRef, scale,
}) {
  const dragging   = useRef(false)
  const dragOrigin = useRef({ mx:0, my:0, sx:0, sy:0 })

  // 반응형 실제 렌더 크기
  const actualSize = sticker.size * scale
  const maxX       = calcMaxX(sticker.size)
  const layer      = sticker.layer ?? 0

  // ── 마우스 드래그 ──
  const handleMouseDown = useCallback((e) => {
    if (!isEditMode) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    dragging.current = true
    dragOrigin.current = { mx: e.clientX, my: e.clientY, sx: sticker.x, sy: sticker.y }

    const onMove = (me) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((me.clientX - dragOrigin.current.mx) / rect.width) * 100
      const dy = ((me.clientY - dragOrigin.current.my) / rect.height) * 100
      onUpdate({
        x: Math.max(0, Math.min(maxX, dragOrigin.current.sx + dx)),
        y: Math.max(0, Math.min(95,   dragOrigin.current.sy + dy)),
      })
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }, [isEditMode, sticker.x, sticker.y, onSelect, onUpdate, containerRef, maxX])

  // ── 터치 드래그 ──
  const handleTouchStart = useCallback((e) => {
    if (!isEditMode) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const touch = e.touches[0]
    dragging.current = true
    dragOrigin.current = { mx: touch.clientX, my: touch.clientY, sx: sticker.x, sy: sticker.y }

    const onMove = (te) => {
      if (!dragging.current || !containerRef.current) return
      const t    = te.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((t.clientX - dragOrigin.current.mx) / rect.width) * 100
      const dy = ((t.clientY - dragOrigin.current.my) / rect.height) * 100
      onUpdate({
        x: Math.max(0, Math.min(maxX, dragOrigin.current.sx + dx)),
        y: Math.max(0, Math.min(95,   dragOrigin.current.sy + dy)),
      })
    }
    const onEnd = () => {
      dragging.current = false
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend',  onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend',  onEnd)
  }, [isEditMode, sticker.x, sticker.y, onSelect, onUpdate, containerRef, maxX])

  return (
    <div
      style={{
        position:  'absolute',
        left:      `${Math.min(sticker.x, maxX)}%`,
        top:       `${sticker.y}%`,
        width:     actualSize,
        height:    actualSize,
        transform: `rotate(${sticker.rotation}deg)`,
        cursor:    isEditMode ? 'grab' : 'default',
        zIndex:    isEditMode ? 200 + layer : 90 + layer,
        userSelect:'none',
        outline:      isEditMode && isSelected ? '2px dashed var(--color-primary)' : 'none',
        outlineOffset: 3,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <img
        src={sticker.url}
        alt=""
        draggable={false}
        style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', pointerEvents:'none' }}
      />
      {isEditMode && isSelected && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{
            position:'absolute', top:-10, right:-10,
            width:22, height:22, borderRadius:'50%',
            background:'#e57373', color:'white',
            border:'2px solid white', cursor:'pointer',
            fontSize:'0.72rem', lineHeight:1,
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
          }}
        >×</button>
      )}
    </div>
  )
}

// ── 슬라이더 행 ──────────────────────────────────────
function SliderRow({ label, value, min, max, step, onChange, unit='' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', minWidth:40, flexShrink:0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex:1, accentColor:'var(--color-primary)', cursor:'pointer' }}/>
      <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', minWidth:40, textAlign:'right' }}>
        {Math.round(value)}{unit}
      </span>
    </div>
  )
}

// layer 없는 스티커에 인덱스 기반으로 자동 부여 (레이어 버그 방지)
const normalizeLayers = (list) => {
  const allHaveLayers = list.every(s => s.layer !== undefined)
  if (allHaveLayers) return list
  return list.map((s, i) => ({ ...s, layer: s.layer ?? i }))
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function StickerLayer({ profile, isOwner, onSave }) {
  const containerRef = useRef(null)

  // ── 반응형: 컨테이너 너비 추적 ──
  const [containerWidth, setContainerWidth] = useState(REFERENCE_WIDTH)
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width || REFERENCE_WIDTH)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])
  const scale = containerWidth / REFERENCE_WIDTH

  // ── 모바일 감지 (window.innerWidth 직접 사용 — containerWidth와 분리) ──
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const savedStickers    = profile?.stickers || []
  const savedHideMobile  = profile?.stickers_hide_mobile ?? false

  const [stickers,    setStickers]    = useState(savedStickers)
  const [hideMobile,  setHideMobile]  = useState(savedHideMobile)
  const [editMode,    setEditMode]    = useState(false)
  const [selectedId,  setSelectedId]  = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [urlInput,    setUrlInput]    = useState('')

  // profile 변경 시 동기화
  useEffect(() => {
    if (!editMode) {
      setStickers(profile?.stickers || [])
      setHideMobile(profile?.stickers_hide_mobile ?? false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.stickers, profile?.stickers_hide_mobile])

  const selectedSticker = stickers.find(s => s.id === selectedId)

  const updateSticker = (id, updates) =>
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))

  const removeSticker = (id) => {
    setStickers(prev => prev.filter(s => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // ── 레이어 앞으로 ──
  const bringForward = (id) => {
    setStickers(prev => {
      const s = prev.find(x => x.id === id)
      if (!s) return prev
      const cur = s.layer ?? 0
      const max = Math.max(...prev.map(x => x.layer ?? 0))
      if (cur >= max) return prev
      return prev.map(x => {
        const xl = x.layer ?? 0
        if (x.id === id)    return { ...x, layer: cur + 1 }
        if (xl === cur + 1) return { ...x, layer: cur }
        return x
      })
    })
  }

  // ── 레이어 뒤로 ──
  const sendBackward = (id) => {
    setStickers(prev => {
      const s = prev.find(x => x.id === id)
      if (!s) return prev
      const cur = s.layer ?? 0
      const min = Math.min(...prev.map(x => x.layer ?? 0))
      if (cur <= min) return prev
      return prev.map(x => {
        const xl = x.layer ?? 0
        if (x.id === id)    return { ...x, layer: cur - 1 }
        if (xl === cur - 1) return { ...x, layer: cur }
        return x
      })
    })
  }

  const handleAddUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    if (stickers.length >= MAX_STICKERS) {
      alert(`스티커는 최대 ${MAX_STICKERS}개까지 추가할 수 있어요.`)
      return
    }
    // layer: 현재 최대값 + 1 (항상 맨 앞에 추가)
    const maxLayer = stickers.length > 0
      ? Math.max(...stickers.map(x => x.layer ?? 0))
      : -1
    const newSticker = {
      id: genId(), url,
      x: 5, y: 5, size: 80, rotation: 0,
      layer: maxLayer + 1,
    }
    setStickers(prev => [...prev, newSticker])
    setSelectedId(newSticker.id)
    setUrlInput('')
  }

  const saveStickers = async () => {
    setSaving(true)
    await onSave({ stickers, stickers_hide_mobile: hideMobile })
    setSaving(false)
    setEditMode(false)
    setSelectedId(null)
  }

  const cancelEdit = () => {
    setStickers(profile?.stickers || [])
    setSelectedId(null)
    setEditMode(false)
    setUrlInput('')
  }

  // 스티커 없고 오너도 아님 → 렌더링 안 함
  if (savedStickers.length === 0 && !isOwner) return null

  // 방문자 + 모바일 + 숨기기 설정 ON → 렌더링 안 함
  if (!isOwner && isMobile && savedHideMobile) return null

  // 선택된 스티커의 레이어 범위
  const allLayers  = stickers.map(x => x.layer ?? 0)
  const maxLayer   = stickers.length > 0 ? Math.max(...allLayers) : 0
  const minLayer   = stickers.length > 0 ? Math.min(...allLayers) : 0
  const selLayer   = selectedSticker?.layer ?? 0
  const canForward = selectedSticker && selLayer < maxLayer
  const canBack    = selectedSticker && selLayer > minLayer

  return (
    <>
      {/* ── 스티커 레이어 ── */}
      <div
        ref={containerRef}
        style={{
          position:'absolute', top:0, left:0, right:0, height:'100vh',
          pointerEvents: editMode ? 'auto' : 'none',
          zIndex: editMode ? 150 : 90,
        }}
        onClick={editMode ? (e) => { if (e.target === e.currentTarget) setSelectedId(null) } : undefined}
      >
        {stickers.map(s => (
          <StickerItem
            key={s.id}
            sticker={s}
            isEditMode={editMode}
            isSelected={selectedId === s.id}
            containerRef={containerRef}
            scale={scale}
            onSelect={() => setSelectedId(s.id)}
            onUpdate={upd => updateSticker(s.id, upd)}
            onRemove={() => removeSticker(s.id)}
          />
        ))}
      </div>

      {/* ── 편집 버튼 (fixed, 오너 전용) ── */}
      {isOwner && !editMode && (
        <button
          onClick={() => {
            setStickers(prev => normalizeLayers(prev))
            setEditMode(true)
          }}
          style={{
            position:'fixed', bottom:116, right:20, zIndex:9999,
            width:36, height:36, borderRadius:'50%',
            background:'var(--color-surface)',
            border:'1px solid var(--color-border)',
            cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 12px rgba(0,0,0,0.15)',
          }}
          title="스티커 편집"
        >
          <Mi size="sm" color="accent">emoji_emotions</Mi>
        </button>
      )}

      {/* ── 편집 패널 (fixed 하단 중앙) ── */}
      {editMode && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          zIndex:10000,
          background:'var(--color-surface)',
          border:'1px solid var(--color-border)',
          borderRadius:16,
          boxShadow:'0 4px 24px rgba(0,0,0,0.18)',
          padding:'14px 16px',
          display:'flex', flexDirection:'column', gap:10,
          minWidth:300, maxWidth:370,
        }}>
          {/* 헤더 */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Mi size="sm" color="accent">emoji_emotions</Mi>
            <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--color-accent)' }}>스티커 편집</span>
            <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginLeft:4 }}>
              ({stickers.length}/{MAX_STICKERS})
            </span>
            {/* 반응형 스케일 표시 */}
            {Math.abs(scale - 1) > 0.05 && (
              <span style={{ fontSize:'0.68rem', color:'var(--color-primary)', marginLeft:'auto', opacity:0.8 }}>
                ×{scale.toFixed(2)}
              </span>
            )}
          </div>

          {/* 선택된 스티커 컨트롤 */}
          {selectedSticker ? (
            <div style={{
              background:'var(--color-nav-active-bg)', borderRadius:10, padding:'10px 12px',
              display:'flex', flexDirection:'column', gap:8,
            }}>
              <div style={{ fontSize:'0.73rem', fontWeight:600, color:'var(--color-accent)', marginBottom:2 }}>
                선택된 스티커 조절
              </div>

              <SliderRow
                label="위치 X" value={selectedSticker.x}
                min={0} max={calcMaxX(selectedSticker.size)} step={0.5} unit="%"
                onChange={v => updateSticker(selectedId, { x: v })}
              />
              <SliderRow
                label="위치 Y" value={selectedSticker.y}
                min={0} max={95} step={0.5} unit="%"
                onChange={v => updateSticker(selectedId, { y: v })}
              />
              <SliderRow
                label="크기" value={selectedSticker.size}
                min={20} max={300} step={5} unit="px"
                onChange={v => updateSticker(selectedId, { size: v })}
              />
              <SliderRow
                label="회전" value={selectedSticker.rotation}
                min={-180} max={180} step={1} unit="°"
                onChange={v => updateSticker(selectedId, { rotation: v })}
              />

              {/* 레이어 컨트롤 */}
              {stickers.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                  <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', minWidth:40, flexShrink:0 }}>
                    레이어
                  </span>
                  <div style={{ display:'flex', gap:5, flex:1 }}>
                    <button
                      onClick={() => sendBackward(selectedId)}
                      disabled={!canBack}
                      className="btn btn-outline btn-sm"
                      style={{ flex:1, fontSize:'0.72rem', opacity: canBack ? 1 : 0.35 }}
                      title="한 단계 뒤로"
                    >
                      ↓ 뒤로
                    </button>
                    <button
                      onClick={() => bringForward(selectedId)}
                      disabled={!canForward}
                      className="btn btn-outline btn-sm"
                      style={{ flex:1, fontSize:'0.72rem', opacity: canForward ? 1 : 0.35 }}
                      title="한 단계 앞으로"
                    >
                      ↑ 앞으로
                    </button>
                  </div>
                  <span style={{ fontSize:'0.68rem', color:'var(--color-text-light)', minWidth:40, textAlign:'right' }}>
                    {selLayer - minLayer + 1}/{stickers.length}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize:'0.78rem', color:'var(--color-text-light)', textAlign:'center', margin:0 }}>
              {stickers.length > 0
                ? '스티커를 클릭하면 조절할 수 있어요'
                : '이미지 URL을 입력해 스티커를 추가하세요'}
            </p>
          )}

          {/* URL 입력으로 스티커 추가 */}
          <div style={{ display:'flex', gap:6 }}>
            <input
              type="text"
              className="form-input"
              placeholder="이미지 URL 입력 후 추가"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddUrl() }}
              style={{ flex:1, fontSize:'0.78rem', padding:'5px 8px' }}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={handleAddUrl}
              disabled={!urlInput.trim() || stickers.length >= MAX_STICKERS}
              style={{ fontSize:'0.78rem', flexShrink:0, display:'flex', alignItems:'center', gap:2 }}
            >
              <Mi size="sm">add</Mi>
            </button>
          </div>

          {/* 모바일 숨기기 토글 */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'8px 10px', borderRadius:8,
            background:'var(--color-nav-active-bg)',
          }}>
            <div>
              <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--color-text)' }}>
                모바일에서 스티커 숨기기
              </div>
              <div style={{ fontSize:'0.68rem', color:'var(--color-text-light)', marginTop:1 }}>
                ON 시 모바일 방문자에게 스티커가 표시되지 않아요
              </div>
            </div>
            <button
              onClick={() => setHideMobile(v => !v)}
              style={{
                width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
                background: hideMobile ? 'var(--color-primary)' : 'var(--color-border)',
                position:'relative', flexShrink:0, marginLeft:10,
                transition:'background 0.2s',
              }}
            >
              <span style={{
                position:'absolute', top:2,
                left: hideMobile ? 20 : 2,
                width:18, height:18, borderRadius:'50%',
                background:'white', transition:'left 0.2s',
                boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
              }}/>
            </button>
          </div>

          {/* 저장/취소 */}
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveStickers} disabled={saving} style={{ flex:1 }}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={cancelEdit} style={{ flex:1 }}>취소</button>
          </div>
        </div>
      )}
    </>
  )
}
