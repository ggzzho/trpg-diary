// src/components/BulkImportModal.js
// 룰북 / 시나리오 CSV·엑셀 일괄 등록 모달 (후원자 전용)
import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Modal } from './Layout'
import { Mi } from './Mi'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── 설정 ──────────────────────────────────────────────────────────────────────
const CONFIG = {
  rulebook: {
    label: '룰북',
    table: 'rulebooks',
    googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1k-aBpkGsTkWozcI9e0Xzp_g7gfYsX-1cn-ZjGf2UOEc/copy',
    // 템플릿 헤더 (한글 표시명 → DB 필드명)
    columns: [
      { header: '제목(필수)',    key: 'title' },
      { header: '수록집(부모룰북)', key: 'parent_title' },
      { header: '출판사',        key: 'publisher' },
      { header: '메모',          key: 'memo' },
      { header: '태그(쉼표구분)', key: 'tags' },
    ],
    // 중복 체크 기준 필드 (제목만)
    dupKeys: ['title'],
    // 행 → insert payload 변환
    rowToPayload: (row, userId, parentId = null) => ({
      user_id: userId,
      title: (row.title || '').trim(),
      publisher: (row.publisher || '').trim() || null,
      memo: (row.memo || '').trim() || null,
      tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      parent_id: parentId,
      color: '',
      cover_image_url: '',
    }),
    sample: [
      { '제목(필수)': '블러드 패스', '수록집(부모룰북)': '', '출판사': '', '메모': '', '태그(쉼표구분)': 'GM,주력' },
    ],
  },
  scenario: {
    label: '시나리오',
    table: 'scenarios',
    googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1QqJ624D1qXqmESm6KuTWEZMj8KLTgGr7qKyhVw5FCfo/copy',
    columns: [
      { header: '제목(필수)',        key: 'title' },
      { header: '수록집',            key: 'parent_title' },
      { header: '룰',               key: 'system_name' },
      { header: '라이터',            key: 'author' },
      { header: '형태',              key: 'format' },
      { header: '인원',              key: 'player_count' },
      { header: '상태태그(쉼표구분)', key: 'status_tags' },
      { header: '시나리오URL',       key: 'scenario_url' },
      { header: '메모',              key: 'memo' },
    ],
    dupKeys: ['title', 'system_name'],
    rowToPayload: (row, userId, parentId = null) => ({
      user_id: userId,
      title: (row.title || '').trim(),
      system_name: (row.system_name || '').trim() || null,
      author: (row.author || '').trim() || null,
      format: (row.format || '').trim() || null,
      player_count: (row.player_count || '').trim() || null,
      status_tags: row.status_tags ? row.status_tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      scenario_url: (row.scenario_url || '').trim() || null,
      memo: (row.memo || '').trim() || null,
      parent_id: parentId,
      purchase_date: null,
    }),
    sample: [
      { '제목(필수)': '가능성의 별', '수록집': '', '룰': '크툴루의 부름 7th', '라이터': '쏘믕 @TRPG_ssomeung', '형태': 'digital', '인원': '1', '상태태그(쉼표구분)': '', '시나리오URL': '', '메모': '시나리오집' },
    ],
  },
  log: {
    label: '다녀온 기록',
    table: 'play_logs',
    googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1S-BsbH6bJbEzgaSFCwCgxQpT7YAVqeWEE0ojoAHx0G8/copy',
    columns: [
      { header: '제목(필수)',    key: 'title' },
      { header: '엔딩날짜(필수)', key: 'played_date' },
      { header: '시작날짜',      key: 'start_date' },
      { header: '룰',           key: 'system_name' },
      { header: '역할',   key: 'role' },
      { header: 'GM',    key: 'together_with' },
      { header: 'PL',    key: 'character_name' },
      { header: 'PC',    key: 'npc' },
      { header: '시리즈',        key: 'series_tag' },
      { header: '입문탁(Y/N)',   key: 'is_intro' },
      { header: '입문룰',        key: 'intro_rule' },
      { header: '메모',          key: 'memo' },
    ],
    dupKeys: ['title', 'played_date'],
    // 날짜 유효성 검사 (YYYY-MM-DD 형식)
    validateRow: row => {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRe.test((row.played_date || '').trim())) return '엔딩날짜가 YYYY-MM-DD 형식이 아니에요'
      if (row.start_date && row.start_date.trim() && !dateRe.test(row.start_date.trim())) return '시작날짜가 YYYY-MM-DD 형식이 아니에요'
      return null
    },
    rowToPayload: (row, userId) => {
      const isIntroRaw = (row.is_intro || '').trim().toUpperCase()
      const isIntro = isIntroRaw === 'Y' || isIntroRaw === 'YES' || isIntroRaw === 'TRUE' || isIntroRaw === '1'
      return {
        user_id: userId,
        title: (row.title || '').trim(),
        played_date: (row.played_date || '').trim(),
        start_date: (row.start_date || '').trim() || null,
        system_name: (row.system_name || '').trim() || null,
        role: ['GM', 'PL'].includes((row.role || '').trim().toUpperCase())
          ? (row.role || '').trim().toUpperCase()
          : 'PL',
        character_name: (row.character_name || '').trim() || null,
        together_with: (row.together_with || '').trim() || null,
        npc: (row.npc || '').trim() || null,
        series_tag: (row.series_tag || '').trim() || null,
        is_intro: isIntro,
        intro_rule: isIntro ? ((row.intro_rule || '').trim() || null) : null,
        memo: (row.memo || '').trim() || null,
        is_private: false,
        extra_urls: [],
      }
    },
    sample: [
      { '제목(필수)': '황혼의 가면무도', '엔딩날짜(필수)': '2024-03-15', '시작날짜': '2024-03-01', '룰': 'CoC 7판', '역할': 'PL', 'GM': '김GM', 'PL': '이유리', 'PC': '탐정 이유리', '시리즈': '가면 시리즈', '입문탁(Y/N)': 'Y', '입문룰': 'CoC', '메모': '첫 솔로 세션' },
    ],
  },
}

// ── 중복 키 만들기 ──────────────────────────────────────────────────────────
function dupKey(row, keys) {
  return keys.map(k => (row[k] || '').toLowerCase().trim()).join('||')
}

// ── 참고표 시트 데이터 ──────────────────────────────────────────────────────
const REFERENCE_SHEETS = {
  rulebook: [
    { 항목: '수록집(부모룰북)', '입력 방법': '서플리먼트인 경우 부모 룰북 제목을 정확히 입력. 독립 룰북은 비워둠', 예시: '크툴루의 부름 7판' },
    { 항목: '',                '입력 방법': '※ 부모 룰북은 같은 파일 안에 있거나 이미 등록된 룰북이어야 연결됨', 예시: '' },
    { 항목: '태그',            '입력 방법': '쉼표로 구분해서 입력', 예시: 'GM,주력,관심' },
  ],
  scenario: [
    { 항목: '수록집', '입력 방법': '수록 시나리오인 경우 부모 시나리오의 제목을 정확히 입력. 독립 시나리오는 비워둠', 예시: '황혼의 가면무도' },
    { 항목: '',       '입력 방법': '※ 수록집은 같은 파일 안에 있거나 이미 등록된 시나리오여야 연결됨', 예시: '' },
    { 항목: '룰',    '입력 방법': '보유 룰북에 등록된 이름과 동일하게 입력', 예시: 'CoC 7판' },
    { 항목: '형태',  '입력 방법': '아래 영문 값 중 하나를 입력', 예시: 'digital' },
    { 항목: '',      '입력 방법': 'physical     → 실물', 예시: '' },
    { 항목: '',      '입력 방법': 'digital      → 전자', 예시: '' },
    { 항목: '',      '입력 방법': 'both         → 실물+전자', 예시: '' },
    { 항목: '',      '입력 방법': 'physical_soft  → 실물(소프트)', 예시: '' },
    { 항목: '',      '입력 방법': 'physical_hard  → 실물(하드)', 예시: '' },
    { 항목: '',      '입력 방법': 'other        → 기타', 예시: '' },
    { 항목: '상태태그', '입력 방법': '쉼표로 구분해서 입력', 예시: 'PL완료,위시' },
    { 항목: '중복 기준', '입력 방법': '제목 + 룰이 동일하면 건너뜀', 예시: '' },
  ],
  log: [
    { 항목: '날짜 형식', '입력 방법': '반드시 YYYY-MM-DD 형식으로 입력', 예시: '2024-03-15' },
    { 항목: '역할',     '입력 방법': 'PL 또는 GM 중 하나 입력. 비워두면 PL로 자동 설정', 예시: 'PL' },
    { 항목: 'GM',      '입력 방법': 'GM 닉네임 입력', 예시: '김GM' },
    { 항목: 'PL',      '입력 방법': 'PL 닉네임 입력', 예시: '이유리' },
    { 항목: 'PC',      '입력 방법': '세션에 등장한 PC·NPC·GMPC 이름', 예시: '탐정 이유리' },
    { 항목: '시리즈',   '입력 방법': '같은 시리즈로 묶을 태그명. 동일한 텍스트끼리 묶임', 예시: '가면 시리즈' },
    { 항목: '입문탁',   '입력 방법': '입문탁 여부. Y 입력 시 입문탁으로 등록. 비워두면 일반 세션', 예시: 'Y' },
    { 항목: '입문룰',   '입력 방법': '입문탁일 때만 적용. 입문한 룰 이름 입력', 예시: 'CoC' },
    { 항목: '중복 기준', '입력 방법': '제목 + 엔딩날짜가 동일하면 건너뜀', 예시: '' },
    { 항목: '미지원 항목', '입력 방법': '이미지, 링크, 스포일러 등은 등록 후 개별 수정해주세요', 예시: '' },
  ],
}

// ── 템플릿 xlsx 다운로드 ──────────────────────────────────────────────────────
function downloadTemplate(type) {
  const cfg = CONFIG[type]

  // 1시트: 데이터 입력 시트
  const ws = XLSX.utils.json_to_sheet(cfg.sample, { header: cfg.columns.map(c => c.header) })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '데이터 입력')

  // 2시트: 참고표
  const refData = REFERENCE_SHEETS[type]
  const wsRef = XLSX.utils.json_to_sheet(refData, { header: ['항목', '입력 방법', '예시'] })
  XLSX.utils.book_append_sheet(wb, wsRef, '참고표')

  XLSX.writeFile(wb, `${cfg.label}_일괄등록_템플릿.xlsx`)
}

// ── 헤더 → key 매핑 ─────────────────────────────────────────────────────────
function mapHeaders(rawHeaders, columns) {
  // 한글 헤더 → key, 영문 key도 직접 허용
  const headerToKey = {}
  columns.forEach(c => {
    headerToKey[c.header.toLowerCase()] = c.key
    headerToKey[c.key.toLowerCase()] = c.key
  })
  return rawHeaders.map(h => headerToKey[(h || '').toLowerCase()] || null)
}

// ── 파일 파싱 ────────────────────────────────────────────────────────────────
async function parseFile(file, columns) {
  const ext = file.name.split('.').pop().toLowerCase()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    const process = rawData => {
      try {
        let wb
        if (ext === 'csv') {
          // CSV: 텍스트로 읽어서 파싱 — BOM·인코딩 문제를 근본적으로 방지
          const text = typeof rawData === 'string'
            ? rawData.replace(/^﻿/, '') // BOM 제거
            : rawData
          wb = XLSX.read(text, { type: 'string' })
        } else {
          // xlsx/xls: 바이너리로 파싱
          wb = XLSX.read(new Uint8Array(rawData), { type: 'array' })
        }
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (raw.length < 2) return resolve([])
        const headers = (raw[0] || []).map(String)
        const keyMap = mapHeaders(headers, columns)
        const rows = []
        for (let i = 1; i < raw.length; i++) {
          const cells = raw[i]
          if (!cells.some(c => String(c).trim())) continue
          const row = {}
          keyMap.forEach((key, idx) => {
            if (key) row[key] = String(cells[idx] || '').trim()
          })
          rows.push(row)
        }
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = reject
    if (ext === 'csv') {
      reader.onload = e => process(e.target.result)
      reader.readAsText(file, 'UTF-8') // 텍스트로 읽기 → 인코딩·BOM 안정적 처리
    } else {
      reader.onload = e => process(e.target.result)
      reader.readAsArrayBuffer(file)
    }
  })
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function BulkImportModal({ isOpen, onClose, type, existingItems = [], onSuccess }) {
  const { user, profile } = useAuth()
  const cfg = CONFIG[type]
  const fileRef = useRef()

  const [step, setStep] = useState('upload')   // 'upload' | 'preview' | 'done'
  const [parsed, setParsed] = useState([])      // 전체 파싱 결과
  const [toInsert, setToInsert] = useState([])  // 중복 제외 후 등록 예정
  const [dupCount, setDupCount] = useState(0)
  const [errCount, setErrCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [failCount, setFailCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fileError, setFileError] = useState('')

  const isSponsor = profile?.membership_tier && profile.membership_tier !== 'free'

  const reset = () => {
    setStep('upload')
    setParsed([])
    setToInsert([])
    setDupCount(0)
    setErrCount(0)
    setDoneCount(0)
    setFailCount(0)
    setFileError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => { reset(); onClose() }

  // 기존 데이터 중복 키 셋
  const existingKeys = new Set(
    existingItems.map(item => dupKey(item, cfg.dupKeys))
  )

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setFileError('.csv 또는 .xlsx 파일만 업로드할 수 있어요.')
      return
    }

    try {
      const rows = await parseFile(file, cfg.columns)
      // 제목 없는 행 + 타입별 추가 유효성 오류 = 형식 오류
      const valid = rows.filter(r => {
        if (!r.title) return false
        if (cfg.validateRow) return !cfg.validateRow(r)
        return true
      })
      const errors = rows.length - valid.length

      // 중복 판별
      const newRows = []
      let dups = 0
      valid.forEach(row => {
        const k = dupKey(row, cfg.dupKeys)
        if (existingKeys.has(k)) { dups++; return }
        newRows.push(row)
      })

      setParsed(rows)
      setToInsert(newRows)
      setDupCount(dups)
      setErrCount(errors)
      setStep('preview')
    } catch {
      setFileError('파일을 읽을 수 없어요. 템플릿 형식을 확인해주세요.')
    }
  }

  const handleImport = async () => {
    if (!toInsert.length) return
    setLoading(true)
    let count = 0
    let fails = 0
    const BATCH = 100

    // 부모-자식 구조가 있는 타입(rulebook, scenario)은 2패스, 없는 타입(log)은 단순 insert
    const hasParentChild = toInsert.some(r => 'parent_title' in r)

    if (hasParentChild) {
      // 1패스: 부모 insert
      const parents = toInsert.filter(r => !(r.parent_title || '').trim())
      const children = toInsert.filter(r => !!(r.parent_title || '').trim())

      const parentPayloads = parents.map(r => cfg.rowToPayload(r, user.id, null))
      for (let i = 0; i < parentPayloads.length; i += BATCH) {
        const batch = parentPayloads.slice(i, i + BATCH)
        const { error } = await supabase.from(cfg.table).insert(batch)
        if (error) { fails += batch.length }
        else { count += batch.length }
      }

      // 2패스: 부모 ID 조회 후 자식 insert
      if (children.length > 0) {
        const parentTitles = [...new Set(children.map(r => r.parent_title.trim()))]
        const { data: dbParents } = await supabase
          .from(cfg.table)
          .select('id, title')
          .eq('user_id', user.id)
          .is('parent_id', null)
          .in('title', parentTitles)

        const parentIdMap = {}
        ;(dbParents || []).forEach(p => { parentIdMap[p.title.toLowerCase()] = p.id })

        const childPayloads = children.map(r => {
          const pid = parentIdMap[(r.parent_title || '').trim().toLowerCase()] || null
          return cfg.rowToPayload(r, user.id, pid)
        })
        for (let i = 0; i < childPayloads.length; i += BATCH) {
          const batch = childPayloads.slice(i, i + BATCH)
          const { error } = await supabase.from(cfg.table).insert(batch)
          if (error) { fails += batch.length }
          else { count += batch.length }
        }
      }
    } else {
      // 단순 insert (부모-자식 없음)
      const payloads = toInsert.map(r => cfg.rowToPayload(r, user.id))
      for (let i = 0; i < payloads.length; i += BATCH) {
        const batch = payloads.slice(i, i + BATCH)
        const { error } = await supabase.from(cfg.table).insert(batch)
        if (error) { fails += batch.length }
        else { count += batch.length }
      }
    }

    setDoneCount(count)
    setFailCount(fails)
    setLoading(false)
    setStep('done')
    if (count > 0) onSuccess?.()
  }

  // ── 비후원자 안내 ──
  if (!isSponsor) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="일괄 등록"
        footer={<button className="btn btn-outline btn-sm" onClick={handleClose}>닫기</button>}
      >
        <div style={{ textAlign:'center', padding:'24px 0' }}>
          <Mi style={{ fontSize:40, color:'var(--color-primary)', marginBottom:12 }}>volunteer_activism</Mi>
          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:8 }}>후원자 전용 기능이에요</div>
          <div className="text-sm text-light" style={{ lineHeight:1.7 }}>
            일괄 등록은 ♥ 원하트 이상 후원자에게만 제공돼요.<br/>
            후원을 통해 더 많은 기능을 이용해보세요!
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${cfg.label} 일괄 등록`}
      footer={
        step === 'upload' ? (
          <button className="btn btn-outline btn-sm" onClick={handleClose}>닫기</button>
        ) : step === 'preview' ? (
          <>
            <button className="btn btn-outline btn-sm" onClick={reset}>다시 선택</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImport}
              disabled={loading || toInsert.length === 0}
            >
              {loading ? '등록 중...' : `${toInsert.length}건 등록하기`}
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleClose}>완료</button>
        )
      }
    >
      {/* ── STEP 1: 업로드 ── */}
      {step === 'upload' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* 템플릿 다운로드 */}
          <div style={{ background:'var(--color-nav-active-bg)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
              <Mi size='sm' color='accent'>download</Mi>
              1단계 — 템플릿 다운로드
            </div>
            <p className="text-sm text-light" style={{ marginBottom:10, lineHeight:1.6 }}>
              {cfg.googleSheetUrl
                ? <>구글 시트 또는 엑셀 템플릿을 받아 작성한 뒤 업로드하세요.<br/>구글 시트는 사본을 만들어 작성 후 CSV로 내보내기 하면 돼요.</>
                : <>엑셀 템플릿을 받아 작성한 뒤 업로드하세요.</>
              }
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {cfg.googleSheetUrl && (
                <a className="btn btn-outline btn-sm" href={cfg.googleSheetUrl} target="_blank" rel="noreferrer">
                  <Mi size='sm'>open_in_new</Mi> 구글 시트 템플릿 열기
                </a>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => downloadTemplate(type)}>
                <Mi size='sm'>table_view</Mi> 엑셀 템플릿 다운로드 (.xlsx)
              </button>
            </div>
          </div>

          {/* 파일 업로드 */}
          <div>
            <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <Mi size='sm' color='accent'>upload_file</Mi>
              2단계 — 파일 업로드
            </div>
            <label style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:8, padding:'28px 20px', borderRadius:10, cursor:'pointer',
              border:'2px dashed var(--color-border)',
              background:'var(--color-nav-active-bg)',
              transition:'border-color 0.2s',
            }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [f] } }) } }}
            >
              <Mi style={{ fontSize:32, color:'var(--color-text-light)' }}>upload</Mi>
              <span className="text-sm" style={{ fontWeight:500 }}>파일을 드래그하거나 클릭해서 선택</span>
              <span className="text-xs text-light">.csv · .xlsx · .xls 지원</span>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }} onChange={handleFile}/>
            </label>
            {fileError && (
              <div style={{ marginTop:8, fontSize:'0.82rem', color:'#e57373', display:'flex', alignItems:'center', gap:4 }}>
                <Mi size='sm' style={{ color:'#e57373' }}>error</Mi>{fileError}
              </div>
            )}
          </div>

          {/* 필드 안내 */}
          <div style={{ fontSize:'0.78rem', color:'var(--color-text-light)', lineHeight:1.8 }}>
            <strong style={{ color:'var(--color-text)' }}>사용 가능한 컬럼:</strong><br/>
            {cfg.columns.map(c => c.header).join(' · ')}
            {type === 'scenario' && (
              <><br/><strong style={{ color:'var(--color-text)' }}>형태 입력값:</strong>{' '}
              physical · digital · both · physical_soft · physical_hard · other</>
            )}
            {type === 'log' && (
              <><br/><strong style={{ color:'var(--color-text)' }}>날짜 형식:</strong>{' '}
              YYYY-MM-DD (예: 2024-03-15)
              <br/><strong style={{ color:'var(--color-text)' }}>역할 입력값:</strong>{' '}
              PL · GM (비워두면 PL)
              <br/><strong style={{ color:'var(--color-text)' }}>입문탁 입력값:</strong>{' '}
              Y (입문탁) · 비워두면 일반 세션
              <br/><strong style={{ color:'var(--color-text)' }}>미지원:</strong>{' '}
              이미지, 링크, 스포일러 등은 등록 후 개별 수정</>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: 미리보기 ── */}
      {step === 'preview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* 요약 카드 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { label:'등록 예정', count: toInsert.length, color:'var(--color-accent)', icon:'check_circle' },
              { label:'중복 건너뜀', count: dupCount, color:'var(--color-primary)', icon:'skip_next' },
              { label:'형식 오류', count: errCount, color:'#e57373', icon:'cancel' },
            ].map(({ label, count, color, icon }) => (
              <div key={label} style={{ background:'var(--color-nav-active-bg)', borderRadius:10, padding:'12px 10px', textAlign:'center' }}>
                <Mi style={{ fontSize:20, color, marginBottom:4 }}>{icon}</Mi>
                <div style={{ fontSize:'1.3rem', fontWeight:700, color }}>{count}</div>
                <div className="text-xs text-light">{label}</div>
              </div>
            ))}
          </div>

          {toInsert.length === 0 ? (
            <div style={{ textAlign:'center', padding:'16px 0', color:'var(--color-text-light)', fontSize:'0.88rem' }}>
              {dupCount > 0 ? '모든 항목이 이미 등록되어 있어요.' : '등록할 수 있는 항목이 없어요. 파일 형식을 확인해주세요.'}
            </div>
          ) : (
            <>
              <div style={{ fontSize:'0.82rem', color:'var(--color-text-light)', fontWeight:600 }}>미리보기 (앞 5건)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {toInsert.slice(0, 5).map((row, i) => (
                  <div key={i} style={{ background:'var(--color-nav-active-bg)', borderRadius:8, padding:'8px 12px', fontSize:'0.83rem' }}>
                    <span style={{ fontWeight:600 }}>{row.title}</span>
                    {row.system_name && <span className="text-xs text-light" style={{ marginLeft:8 }}>{row.system_name}</span>}
                    {(row.author) && <span className="text-xs text-light" style={{ marginLeft:8 }}>{row.author}</span>}
                  </div>
                ))}
                {toInsert.length > 5 && (
                  <div className="text-xs text-light" style={{ textAlign:'center', paddingTop:4 }}>
                    외 {toInsert.length - 5}건 더...
                  </div>
                )}
              </div>
            </>
          )}

          {dupCount > 0 && (
            <div style={{ fontSize:'0.78rem', color:'var(--color-text-light)', background:'var(--color-nav-active-bg)', borderRadius:8, padding:'8px 12px', lineHeight:1.6 }}>
              ℹ️ 중복 기준: {type === 'rulebook' ? '제목이 동일한 경우' : type === 'log' ? '제목 + 엔딩날짜가 동일한 경우' : '제목 + 시스템명이 동일한 경우'} 건너뜁니다.
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: 완료 ── */}
      {step === 'done' && (
        <div style={{ textAlign:'center', padding:'24px 0' }}>
          <Mi style={{ fontSize:44, color: failCount > 0 && doneCount === 0 ? '#e57373' : 'var(--color-accent)', marginBottom:12 }}>
            {failCount > 0 && doneCount === 0 ? 'error' : 'check_circle'}
          </Mi>
          <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:8 }}>
            {doneCount > 0 ? `${doneCount}건이 등록되었어요!` : '등록된 항목이 없어요.'}
          </div>
          {dupCount > 0 && (
            <div className="text-sm text-light" style={{ marginBottom:4 }}>{dupCount}건은 중복으로 건너뛰었어요.</div>
          )}
          {failCount > 0 && (
            <div style={{ marginTop:8, fontSize:'0.83rem', color:'#e57373', background:'#ffeaea', borderRadius:8, padding:'8px 14px', display:'inline-block' }}>
              <Mi size='sm' style={{ color:'#e57373', verticalAlign:'middle', marginRight:4 }}>warning</Mi>
              {failCount}건은 오류로 등록에 실패했어요.<br/>
              <span style={{ fontSize:'0.78rem' }}>잠시 후 다시 시도하거나, 파일 내용을 확인해주세요.</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
