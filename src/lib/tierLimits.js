// src/lib/tierLimits.js
// 등급별 데이터 한도 — StoragePage, Dashboard, Layout 등 공통 참조

export const TIER_LIMITS = {
  free:   1000,
  '1ht':  3000,
  '2ht':  5000,
  '3ht':  8000,
  master: null, // 무제한
}

export const TIER_LABEL = {
  free:   '일반',
  '1ht':  '♥ 원하트',
  '2ht':  '♥♥ 투하트',
  '3ht':  '♥♥♥ 풀하트',
  master: '마스터',
}
