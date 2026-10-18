export type QualityProfile = 'mobile-low' | 'mobile-high' | 'desktop';

export interface DeviceInfo {
  isTouch: boolean;
  isMobile: boolean;
  hasWebGPU: boolean;
  profile: QualityProfile;
  /** Internal render scale applied via graphicsDevice.maxPixelRatio. */
  maxPixelRatio: number;
}

export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (isTouch && coarse);
  const hasWebGPU = typeof (navigator as Navigator & { gpu?: unknown }).gpu !== 'undefined';

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;

  let profile: QualityProfile = 'desktop';
  if (isMobile) profile = mem <= 4 || cores <= 4 ? 'mobile-low' : 'mobile-high';

  const dpr = window.devicePixelRatio || 1;
  const maxPixelRatio = profile === 'mobile-low' ? Math.min(dpr, 1.25) : profile === 'mobile-high' ? Math.min(dpr, 2) : Math.min(dpr, 2);

  return { isTouch, isMobile, hasWebGPU, profile, maxPixelRatio };
}
