'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/** Phần tử bị con trỏ kéo nhẹ về phía mình khi lại gần, rồi bật về chỗ cũ. */
export default function Magnetic({ children, strength = 0.25, className = '' }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover)').matches) return;
    const clamp = gsap.utils.clamp(-10, 10);
    const qx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const qy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      qx(clamp((e.clientX - (b.left + b.width / 2)) * strength));
      qy(clamp((e.clientY - (b.top + b.height / 2)) * strength));
    };
    const leave = () => {
      qx(0);
      qy(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
    };
  }, [strength]);
  return (
    <span ref={ref} className={`inline-flex will-change-transform ${className}`}>
      {children}
    </span>
  );
}
