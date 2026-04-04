// src/hooks/usePagination.js
import { useState, useMemo } from 'react'

export function usePagination(items, defaultPerPage = 20) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(defaultPerPage)

  const totalPages = Math.ceil(items.length / perPage)
  const paged = useMemo(
    () => items.slice((page - 1) * perPage, page * perPage),
    [items, page, perPage]
  )

  return { paged, page, setPage, perPage, setPerPage, totalPages }
}
