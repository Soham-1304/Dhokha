import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    let mx = 0, my = 0, cx = 0, cy = 0;

    const handleMouseMove = (e) => { mx = e.clientX; my = e.clientY; };

    let raf;
    const loop = () => {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      if (cursor) { cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px'; }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove);
    loop();

    const over = (e) => { if (e.target.closest('[data-hover], .card, a, button')) cursor.classList.add('hover'); };
    const out = (e) => { if (e.target.closest('[data-hover], .card, a, button')) cursor.classList.remove('hover'); };

    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div className="cursor" ref={cursorRef} />;
}
