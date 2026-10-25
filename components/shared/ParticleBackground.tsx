import React, { useMemo } from 'react';

const ParticleBackground: React.FC = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${10 + Math.random() * 15}s`,
      delay: `${Math.random() * 10}s`,
      size: `${2 + Math.random() * 4}px`,
      opacity: 0.2 + Math.random() * 0.4
    }));
  }, []);

  return (
    <>
      <style>{`
        @keyframes falling {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh) translateX(20px); opacity: 0; }
        }
        .animate-falling {
          animation: falling linear infinite;
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none no-print" aria-hidden="true">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute bg-slate-400 rounded-full animate-falling"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDuration: p.duration,
              animationDelay: p.delay,
              top: '-5vh'
            }}
          />
        ))}
      </div>
    </>
  );
};

export default ParticleBackground;
