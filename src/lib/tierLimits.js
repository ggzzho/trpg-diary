// src/lib/tierLimits.js
// 등급별 데이터 한도 — StoragePage, Dashboard, Layout 등 공통 참조

export const TIER_LIMITS = {
  free:   1000,
  lv1:    3000,
  lv2:    5000,
  lv3:    8000,
  master: null, // 무제한
}

export const TIER_LABEL = {
  free:   '일반',
  lv1:    '♥ 원하트',
  lv2:    '♥♥ 투하트',
  lv3:    '♥♥♥ 풀하트',
  master: '마스터',
}
