// src/lib/storageError.js
// 저장 공간 한도 초과 에러 감지 유틸

/**
 * Supabase INSERT 에러가 storage_limit_exceeded인지 확인
 * @param {object} error - supabase 에러 객체
 * @returns {boolean}
 */
export function isStorageLimitError(error) {
  if (!error) return false
  const msg = error.message || error.details || ''
  return msg.includes('storage_limit_exceeded')
}

/**
 * INSERT 결과에서 저장 한도 에러를 처리 후 toast 표시
 * 나머지 에러는 그대로 반환
 *
 * @param {object} error - supabase 에러 객체
 * @param {function} showToast - (msg, type) => void
 * @returns {boolean} true = 저장 한도 에러였음 (처리 완료), false = 다른 에러
 */
export function handleStorageLimitError(error, showToast) {
  if (!isStorageLimitError(error)) return false
  const msg = '저장 공간이 꽉 찼어요. 데이터를 정리하거나 후원을 통해 용량을 늘려보세요!'
  if (typeof showToast === 'function') {
    showToast(msg, 'storage')
  } else {
    alert(msg)
  }
  return true
}
