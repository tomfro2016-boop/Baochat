'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Lưới chấm phản ứng với con trỏ: chấm gần con trỏ to dần, sáng dần sang màu nhấn
 * và bị đẩy nhẹ ra xa. Vẽ bằng canvas, dừng khi tab ẩn hoặc khi người dùng giảm chuyển động.
 */
export default function DotField({ className = '', gap = 24, radius = 140 }: { className?: string; gap?: number; radius?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parent = canvas.parentElement!;

    let w = 0;
    let h = 0;
    let dots: { x: number; y: number }[] = [];
    const pointer = { x: -9999, y: -9999, active: 0 };
    const near = gsap.utils.mapRange(0, radius, 1, 0); // càng gần càng mạnh
    const clamp01 = gsap.utils.clamp(0, 1);
    let ink: number[] = [140, 134, 124];
    let primary: number[] = [240, 165, 40];
    let raf = 0;
    let visible = true;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const triple = (n: string) => cs.getPropertyValue(n).trim().split(/\s+/).map(Number);
      const m = triple('--muted');
      const p = triple('--primary');
      if (m.length === 3 && !m.some(isNaN)) ink = m;
      if (p.length === 3 && !p.some(isNaN)) primary = p;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const cols = Math.ceil(w / gap) + 1;
      const rows = Math.ceil(h / gap) + 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push({ x: c * gap + gap / 2, y: r * gap + gap / 2 });
      readColors();
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const dx = d.x - pointer.x;
        const dy = d.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        const k = dist < radius ? clamp01(near(dist)) * pointer.active : 0;
        const push = k * 6;
        const x = d.x + (dist ? (dx / dist) * push : 0);
        const y = d.y + (dist ? (dy / dist) * push : 0);
        const r = 1 + k * 1.6;
        const a = 0.22 + k * 0.78;
        const col = k > 0.02 ? gsap.utils.interpolate(ink, primary, k) : ink;
        ctx.fillStyle = `rgba(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      pointer.x = e.clientX - b.left;
      pointer.y = e.clientY - b.top;
      gsap.to(pointer, { active: 1, duration: 0.25, overwrite: true });
    };
    const onLeave = () => gsap.to(pointer, { active: 0, duration: 0.5, overwrite: true });
    const onVis = () => (visible = !document.hidden);

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    // Đổi theme thì đọc lại màu
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    if (!reduce) {
      window.addEventListener('pointermove', onMove);
      parent.addEventListener('pointerleave', onLeave);
      document.addEventListener('visibilitychange', onVis);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('pointermove', onMove);
      parent.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      gsap.killTweensOf(pointer);
    };
  }, [gap, radius]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />;
}
