// src/lib/dateFormatters.js
// year:'2-digit' + 시간 — GuestbookPage, AdminFeedbackPage
export const fmtDTShort = (d) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('ko-KR', { year:'2-digit', month:'numeric', day:'numeric' })
    + ' ' + dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
}

// year:'numeric', 날짜만 — NoticeListPage
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('ko-KR', { year:'numeric', month:'numeric', day:'numeric' })

// year:'numeric' + 시간 — NotificationCenterPage
export const fmtDT = (d) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('ko-KR', { year:'numeric', month:'numeric', day:'numeric' })
    + ' ' + dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
}

// 상대 시간 — Layout.js, NotificationCenterPage
export const fmtAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return '방금 전'
  if (diff < 3600)  return `${Math.floor(diff/60)}분 전`
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`
  return `${Math.floor(diff/86400)}일 전`
}

// 24시간 이내 여부 — NoticeListPage
export const isNew = (dateStr) => Date.now() - new Date(dateStr).getTime() < 86400000
