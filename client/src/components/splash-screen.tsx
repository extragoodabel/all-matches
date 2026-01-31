import { useEffect, useState, useMemo } from "react";

const EMOJIS = ["💖", "🔥", "✨", "💫", "🎯", "💕", "⚡", "🌟", "💝", "🦋", "🌸", "💜", "🎪", "🎭", "💅", "👀", "😍", "🤩", "💀", "🙈"];

interface FloatingEmoji {
  id: number;
  emoji: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function generateEmojis(count: number): FloatingEmoji[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: EMOJIS[i % EMOJIS.length],
    startX: -20 + (Math.random() * 40),
    startY: 120 + (Math.random() * 20),
    endX: 20 + (Math.random() * 80),
    endY: -20 - (Math.random() * 40),
    delay: i * 25,
    duration: 600 + (Math.random() * 300),
    size: 20 + (Math.random() * 16),
    rotation: Math.random() * 720 - 360,
  }));
}

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
  maxDuration?: number;
}

export function SplashScreen({ 
  onComplete, 
  minDuration = 900, 
  maxDuration = 2500 
}: SplashScreenProps) {
  const [phase, setPhase] = useState<"logo" | "emojis" | "card" | "exit">("logo");
  const [startTime] = useState(() => Date.now());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  const emojis = useMemo(() => generateEmojis(18), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        setPhase("exit");
        setTimeout(onComplete, 300);
      }, minDuration);
      return () => clearTimeout(timer);
    }

    const logoTimer = setTimeout(() => setPhase("emojis"), 400);
    const emojiTimer = setTimeout(() => setPhase("card"), 1100);
    const exitTimer = setTimeout(() => {
      setPhase("exit");
      setTimeout(onComplete, 400);
    }, Math.min(1800, maxDuration - 400));

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(emojiTimer);
      clearTimeout(exitTimer);
    };
  }, [prefersReducedMotion, minDuration, maxDuration, onComplete]);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (phase !== "exit") {
        setPhase("exit");
        setTimeout(onComplete, 200);
      }
    }, maxDuration);
    return () => clearTimeout(safetyTimer);
  }, [maxDuration, onComplete, phase]);

  if (prefersReducedMotion) {
    return (
      <div 
        className={`splash-overlay ${phase === "exit" ? "splash-fade-out" : ""}`}
        style={{ background: "var(--eg-background)" }}
      >
        <div className="splash-content">
          <div className="splash-logo-text">All Matches</div>
          <div className="splash-card">
            <h1 className="splash-headline">All validation. No obligation.</h1>
            <p className="splash-subhead">No profile. No pressure. Your matches are already waiting.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`splash-overlay ${phase === "exit" ? "splash-exit" : ""}`}>
      <div className="splash-pattern-layer" />
      <div className="splash-pattern-layer splash-pattern-2" />
      <div className="splash-pattern-layer splash-pattern-3" />

      <div className="splash-content">
        <div className={`splash-logo ${phase !== "logo" ? "splash-logo-visible" : ""}`}>
          <div className="splash-logo-text">All Matches</div>
        </div>

        <div className={`splash-emoji-container ${phase === "emojis" || phase === "card" || phase === "exit" ? "splash-emoji-active" : ""}`}>
          {emojis.map((e) => (
            <span
              key={e.id}
              className="splash-emoji"
              style={{
                "--start-x": `${e.startX}vw`,
                "--start-y": `${e.startY}vh`,
                "--end-x": `${e.endX}vw`,
                "--end-y": `${e.endY}vh`,
                "--delay": `${e.delay}ms`,
                "--duration": `${e.duration}ms`,
                "--size": `${e.size}px`,
                "--rotation": `${e.rotation}deg`,
              } as React.CSSProperties}
            >
              {e.emoji}
            </span>
          ))}
        </div>

        <div className={`splash-card-container ${phase === "card" || phase === "exit" ? "splash-card-visible" : ""}`}>
          <div className="splash-card">
            <h1 className="splash-headline">All validation. No obligation.</h1>
            <p className="splash-subhead">No profile. No pressure. Your matches are already waiting.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
