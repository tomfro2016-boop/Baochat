import { useCallback } from 'react';

/** Ghi vị trí con trỏ vào --mx/--my để CSS vẽ vệt sáng trung tính đi theo trên hàng/thẻ. */
export function useSpotlight() {
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const b = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - b.left}px`);
    el.style.setProperty('--my', `${e.clientY - b.top}px`);
  }, []);
}
