// src/components/supporter/StickerLayer.js
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mi } from '../Mi'

const MAX_STICKERS = 10
const genId = () => `s${Date.now()}${Math.random().toString(36).slice(2, 7)}`

// ── 단일 스티커 ──────────────────────────────────────
function StickerItem({ sticker, isEditMode, isSelected, onSelect, onUpdate, onRemove, containerRef }) {
  const dragging = useRef(false)
  const dragOrigin = useRef({ mx:0, my:0, sx:0, sy:0 })

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
        x: Math.max(0, Math.min(95, dragOrigin.current.sx + dx)),
        y: Math.max(0, Math.min(95, dragOrigin.current.sy + dy)),
      })
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [isEditMode, sticker.x, sticker.y, onSelect, onUpdate, containerRef])

  // 터치 지원
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
      const t = te.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((t.clientX - dragOrigin.current.mx) / rect.width) * 100
      const dy = ((t.clientY - dragOrigin.current.my) / rect.height) * 100
      onUpdate({
        x: Math.max(0, Math.min(95, dragOrigin.current.sx + dx)),
        y: Math.max(0, Math.min(95, dragOrigin.current.sy + dy)),
      })
    }
    const onEnd = () => {
      dragging.current = false
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }, [isEditMode, sticker.x, sticker.y, onSelect, onUpdate, containerRef])

  return (
    <div
      style={{
        position:'absolute',
        left:`${sticker.x}%`,
        top:`${sticker.y}%`,
        width:sticker.size,
        height:sticker.size,
        transform:`rotate(${sticker.rotation}deg)`,
        cursor: isEditMode ? 'grab' : 'default',
        zIndex: isEditMode ? 200 : 100,
        userSelect:'none',
        outline: isEditMode && isSelected ? '2px dashed var(--color-primary)' : 'none',
        outlineOffset:3,
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

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function StickerLayer({ profile, isOwner, onSave }) {
  const containerRef = useRef(null)

  const savedStickers = profile?.stickers || []
  const [stickers,   setStickers]   = useState(savedStickers)
  const [editMode,   setEditMode]   = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [urlInput,   setUrlInput]   = useState('')

  // profile 변경 시 stickers 동기화 (저장 후 등)
  useEffect(() => {
    if (!editMode) setStickers(profile?.stickers || [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.stickers])

  const selectedSticker = stickers.find(s => s.id === selectedId)

  const updateSticker = (id, updates) =>
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))

  const removeSticker = (id) => {
    setStickers(prev => prev.filter(s => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleAddUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    if (stickers.length >= MAX_STICKERS) {
      alert(`스티커는 최대 ${MAX_STICKERS}개까지 추가할 수 있어요.`)
      return
    }
    const newSticker = { id: genId(), url, x: 5, y: 5, size: 80, rotation: 0 }
    setStickers(prev => [...prev, newSticker])
    setSelectedId(newSticker.id)
    setUrlInput('')
  }

  const saveStickers = async () => {
    setSaving(true)
    await onSave({ stickers })
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

  return (
    <>
      {/* ── 스티커 레이어 (페이지 전체에 absolute) ── */}
      <div
        ref={containerRef}
        style={{
          position:'absolute', inset:0,
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
            onSelect={() => setSelectedId(s.id)}
            onUpdate={upd => updateSticker(s.id, upd)}
            onRemove={() => removeSticker(s.id)}
          />
        ))}
      </div>

      {/* ── 편집 버튼 (fixed, 오너 전용) ── */}
      {isOwner && !editMode && (
        <button
          onClick={() => setEditMode(true)}
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
          minWidth:290, maxWidth:360,
        }}>
          {/* 헤더 */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Mi size="sm" color="accent">emoji_emotions</Mi>
            <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--color-accent)' }}>스티커 편집</span>
            <span style={{ fontSize:'0.72rem', color:'var(--color-text-light)', marginLeft:4 }}>
              ({stickers.length}/{MAX_STICKERS})
            </span>
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
              <SliderRow label="위치 X" value={selectedSticker.x}        min={0}    max={95}   step={0.5} unit="%" onChange={v => updateSticker(selectedId, { x: v })}/>
              <SliderRow label="위치 Y" value={selectedSticker.y}        min={0}    max={95}   step={0.5} unit="%" onChange={v => updateSticker(selectedId, { y: v })}/>
              <SliderRow label="크기"   value={selectedSticker.size}     min={20}   max={300}  step={5}   unit="px" onChange={v => updateSticker(selectedId, { size: v })}/>
              <SliderRow label="회전"   value={selectedSticker.rotation} min={-180} max={180}  step={1}   unit="°"  onChange={v => updateSticker(selectedId, { rotation: v })}/>
            </div>
          ) : (
            <p style={{ fontSize:'0.78rem', color:'var(--color-text-light)', textAlign:'center', margin:0 }}>
              {stickers.length > 0 ? '스티커를 클릭하면 조절할 수 있어요' : '이미지 URL을 입력해 스티커를 추가하세요'}
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
