// src/hooks/usePagination.js
import { useState, useMemo, useEffect, useRef } from 'react'

export function usePagination(items, defaultPerPage = 10) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(defaultPerPage)
  const prevLengthRef = useRef(items.length)

  // 아이템 수가 바뀌면 (검색/필터 적용 시) 1페이지로 리셋
  useEffect(() => {
    if (prevLengthRef.current !== items.length) {
      setPage(1)
      prevLengthRef.current = items.length
    }
  }, [items.length])

  const totalPages = Math.ceil(items.length / perPage)
  const paged = useMemo(
    () => items.slice((page - 1) * perPage, page * perPage),
    [items, page, perPage]
  )

  return { paged, page, setPage, perPage, setPerPage, totalPages }
}
