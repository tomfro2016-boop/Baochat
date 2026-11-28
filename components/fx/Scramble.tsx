'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789<>_/\\[]{}=+*';

/** Chữ "giải mã" từ ký tự ngẫu nhiên thành nội dung thật, chạy một lần khi xuất hiện. */
export default function Scramble({ text, delay = 0, duration = 0.9, className = '' }: { text: string; delay?: number; duration?: number; className?: string }) {
  const [out, setOut] = useState(text);
  const first = useRef(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOut(text);
      return;
    }
    const pick = gsap.utils.random(GLYPHS.split(''), true);
    const state = { p: 0 };
    const tw = gsap.to(state, {
      p: 1,
      duration: first.current ? duration : duration * 0.6,
      delay: first.current ? delay : 0,
      ease: 'power2.out',
      onUpdate: () => {
        const upto = Math.floor(state.p * text.length);
        setOut(
          text
            .split('')
            .map((ch, i) => (i < upto || ch === ' ' ? ch : pick()))
            .join(''),
        );
      },
      onComplete: () => setOut(text),
    });
    first.current = false;
    return () => {
      tw.kill();
    };
  }, [text, delay, duration]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}
