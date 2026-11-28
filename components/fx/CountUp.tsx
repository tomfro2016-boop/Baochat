'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { fmtNum } from '@/lib/client/util';

/** Số chạy từ giá trị cũ sang giá trị mới thay vì nhảy cách quãng. */
export default function CountUp({ value, className = '' }: { value: number | null | undefined; className?: string }) {
  const [shown, setShown] = useState<number | null | undefined>(value);
  const cur = useRef({ v: typeof value === 'number' ? value : 0 });

  useEffect(() => {
    if (typeof value !== 'number' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      if (typeof value === 'number') cur.current.v = value;
      return;
    }
    const tw = gsap.to(cur.current, {
      v: value,
      duration: 0.8,
      ease: 'power3.out',
      onUpdate: () => setShown(Math.round(cur.current.v)),
      onComplete: () => setShown(value),
    });
    return () => {
      tw.kill();
    };
  }, [value]);

  return <span className={`tabular-nums ${className}`}>{fmtNum(shown)}</span>;
}
