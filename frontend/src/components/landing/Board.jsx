import { useEffect, useRef } from 'react';

export default function Board() {
  const boardWrapRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const boardWrap = boardWrapRef.current;
    if (!boardWrap) return;

    const handleMouseMove = (e) => {
      const r = boardWrap.getBoundingClientRect();
      const relX = (e.clientX - r.left) / r.width - 0.5;
      const relY = (e.clientY - r.top) / r.height - 0.5;
      
      cardsRef.current.forEach((c, i) => {
        if (!c) return;
        const depth = (i + 1) * 4;
        c.style.transform = (c.classList.contains('c-center') ? 'translateX(-50%) ' : '') +
          `rotate(${relX * depth}deg) translateY(${relY * depth}px)`;
      });
    };

    const handleMouseLeave = () => {
      cardsRef.current.forEach((c) => {
        if (!c) return;
        c.style.transform = c.classList.contains('c-center') ? 'translateX(-50%)' : '';
      });
    };

    boardWrap.addEventListener('mousemove', handleMouseMove);
    boardWrap.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      boardWrap.removeEventListener('mousemove', handleMouseMove);
      boardWrap.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="board-wrap" ref={boardWrapRef}>
      <svg className="strings" viewBox="0 0 980 340" preserveAspectRatio="none">
        <path className="string-path d1" d="M 145 55 Q 400 40 460 260" />
        <path className="string-path d2" d="M 490 40 Q 500 150 490 260" />
        <path className="string-path d3" d="M 855 55 Q 620 60 530 260" />
      </svg>
      
      <div className="landing-card c1" data-tilt ref={el => cardsRef.current[0] = el}>
        <div className="pin"></div>
        <div className="bank">Bank A</div>
        <div className="amt">₹48,200</div>
        <div className="id">TXN-9F21-A</div>
      </div>
      
      <div className="landing-card c2 flagged" data-tilt ref={el => cardsRef.current[1] = el}>
        <div className="pin"></div>
        <div className="bank">Bank B</div>
        <div className="amt">₹63,500</div>
        <div className="id">TXN-7C08-B</div>
      </div>
      
      <div className="landing-card c3" data-tilt ref={el => cardsRef.current[2] = el}>
        <div className="pin"></div>
        <div className="bank">Bank C</div>
        <div className="amt">₹12,400</div>
        <div className="id">TXN-4B22-A</div>
      </div>
      
      <div className="landing-card c-center flagged" data-tilt ref={el => cardsRef.current[3] = el}>
        <div className="pin"></div>
        <div className="bank">Collector Account</div>
        <div className="amt">₹2,23,700</div>
        <div className="id">MULE-RING-0092</div>
      </div>
    </div>
  );
}
