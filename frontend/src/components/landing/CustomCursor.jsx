import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    document.body.classList.add('has-custom-cursor');

    let mx = 0, my = 0, cx = 0, cy = 0;
    
    const handleMouseMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
    };
    
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

    // Handle hover states based on elements with data-hover attribute or specific tags
    const handleMouseOver = (e) => {
      const target = e.target.closest('[data-hover], .card, a, button');
      if (target) {
        cursor.classList.add('hover');
      }
    };
    const handleMouseOut = (e) => {
      const target = e.target.closest('[data-hover], .card, a, button');
      if (target) {
        cursor.classList.remove('hover');
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.body.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <div className="cursor" ref={cursorRef}></div>;
}
