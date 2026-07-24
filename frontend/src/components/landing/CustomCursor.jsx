import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    document.body.classList.add('has-custom-cursor');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let cx = mx;
    let cy = my;
    
    const handleMouseMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      const isInteractive = e.target.closest('a, button, input, select, textarea, [data-hover], [role="button"]');
      cursor.classList.toggle('hover', Boolean(isInteractive));
      cursor.classList.remove('is-hidden');
    };

    const handleMouseLeave = () => cursor.classList.add('is-hidden');
    const handleMouseEnter = () => cursor.classList.remove('is-hidden');
    
    let animationFrameId;
    
    const loop = () => {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      if (cursor) {
        cursor.style.left = cx + 'px';
        cursor.style.top = cy + 'px';
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove);
    loop();

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.body.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <div className="cursor" ref={cursorRef}></div>;
}
