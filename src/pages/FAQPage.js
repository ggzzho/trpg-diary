// src/pages/FAQPage.js
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { MarkdownRenderer } from './AdminNoticePage'

const CATEGORIES = ['계정', '기능', '이용방법', '결제·후원', '기타']

// ── 아코디언 항목 ──────────────────────────────────────────────
function FaqItem({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', gap: 12,
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{
            fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem', flexShrink: 0, lineHeight: 1.5,
          }}>Q.</span>
          <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
            {item.question}
          </span>
        </div>
        <span className="ms" style={{
          fontSize: 20, color: 'var(--color-text-light)', flexShrink: 0,
          transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>expand_more</span>
      </button>

      {open && (
        <div style={{
          padding: '14px 18px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-nav-active-bg)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{
              fontWeight: 700, color: 'var(--color-accent)', fontSize: '1rem', flexShrink: 0, lineHeight: 1.5,
            }}>A.</span>
            <MarkdownRenderer content={item.answer} style={{ flex: 1 }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── FAQ 목록 (SupportPage에서도 재사용) ───────────────────────
export function FAQList() {
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('faqs').select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      setFaqs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = faqs.filter(f => {
    const matchCat    = activeCategory === 'all' || f.category === activeCategory
    const matchSearch = !search.trim() || f.question.includes(search) || f.answer.includes(search)
    return matchCat && matchSearch
  })

  // 실제 데이터가 있는 카테고리만 탭으로 표시
  const usedCategories = CATEGORIES.filter(c => faqs.some(f => f.category === c))

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
      불러오는 중...
    </div>
  )

  if (faqs.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-light)' }}>
      <Mi style={{ fontSize: 40, marginBottom: 12, display: 'block', opacity: 0.3 }}>help_outline</Mi>
      <p style={{ fontSize: '0.9rem' }}>아직 등록된 FAQ가 없어요</p>
    </div>
  )

  return (
    <div>
      {/* 검색 */}
      <div style={{ marginBottom: 14 }}>
        <input className="form-input" placeholder="🔍 질문·답변 검색..."
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveCategory('all') }}
          style={{ maxWidth: 320 }} />
      </div>

      {/* 카테고리 탭 (검색 중엔 숨김) */}
      {!search.trim() && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeCategory === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveCategory('all')}>
            전체
          </button>
          {usedCategories.map(c => (
            <button key={c}
              className={`btn btn-sm ${activeCategory === c ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)', fontSize: '0.88rem' }}>
            검색 결과가 없어요
          </div>
        : search.trim()
          // 검색 중: 카테고리 구분 없이 나열
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(f => <FaqItem key={f.id} item={f} />)}
            </div>
          // 카테고리별 섹션
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {(activeCategory === 'all' ? usedCategories : [activeCategory]).map(cat => {
                const items = filtered.filter(f => f.category === cat)
                if (items.length === 0) return null
                return (
                  <div key={cat}>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{
                        padding: '2px 12px', borderRadius: 100,
                        fontSize: '0.75rem', fontWeight: 700,
                        background: 'var(--color-nav-active-bg)',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-border)',
                      }}>{cat}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {items.map(f => <FaqItem key={f.id} item={f} />)}
                    </div>
                  </div>
                )
              })}
            </div>
      }
    </div>
  )
}

// ── 메인 FAQ 페이지 (/faq) ─────────────────────────────────────
export default function FAQPage() {
  const navigate = useNavigate()

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">
              <Mi style={{ marginRight: 8, verticalAlign: 'middle' }}>help_outline</Mi>자주 묻는 질문
            </h1>
            <p className="page-subtitle">궁금한 내용을 빠르게 확인해보세요</p>
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}
            onClick={() => navigate('/support')}>
            <Mi size="sm">support_agent</Mi> 문의하기
          </button>
        </div>
      </div>

      <FAQList />
    </div>
  )
}
