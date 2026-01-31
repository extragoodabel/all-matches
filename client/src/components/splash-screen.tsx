import { useEffect, useState, useMemo, useCallback } from "react";

const EMOJIS = ["💖", "🔥", "✨", "💫", "🎯", "💕", "⚡", "🌟", "💝", "🦋", "🌸", "💜", "🎪", "🎭", "💅", "👀", "😍", "🤩", "💀", "🙈", "🫶", "💗", "🥰", "😘", "🫠", "🤭", "😏", "🥵", "💋", "❤️‍🔥"];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  layer: "back" | "front";
}

function generateEmojis(count: number): FloatingEmoji[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: EMOJIS[i % EMOJIS.length],
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 18 + Math.random() * 24,
    delay: Math.random() * 400,
    duration: 800 + Math.random() * 600,
    rotation: Math.random() * 720 - 360,
    layer: Math.random() > 0.4 ? "front" : "back",
  }));
}

interface SplashScreenProps {
  onComplete: () => void;
}

type Phase = "storm" | "logo" | "overwhelm" | "card" | "wipe" | "exit";

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>("storm");
  const [dismissed, setDismissed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const emojis = useMemo(() => generateEmojis(50), []);
  const backEmojis = useMemo(() => emojis.filter(e => e.layer === "back"), [emojis]);
  const frontEmojis = useMemo(() => emojis.filter(e => e.layer === "front"), [emojis]);

  const handleDismiss = useCallback(() => {
    if (!dismissed) {
      setDismissed(true);
      onComplete();
    }
  }, [dismissed, onComplete]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      const timer = setTimeout(handleDismiss, 2500);
      return () => clearTimeout(timer);
    }

    const timers = [
      setTimeout(() => setPhase("logo"), 600),
      setTimeout(() => setPhase("overwhelm"), 1300),
      setTimeout(() => setPhase("card"), 2000),
      setTimeout(() => setPhase("wipe"), 3200),
      setTimeout(() => setPhase("exit"), 3700),
      setTimeout(handleDismiss, 4000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion, handleDismiss]);

  useEffect(() => {
    const safetyTimer = setTimeout(handleDismiss, 4500);
    return () => clearTimeout(safetyTimer);
  }, [handleDismiss]);

  if (dismissed) return null;

  if (prefersReducedMotion) {
    return (
      <div className="splash-overlay splash-reduced">
        <div className="splash-pattern-base" />
        <div className="splash-content">
          <div className="splash-logo-text splash-logo-visible-reduced">All Matches</div>
          <div className="splash-card splash-card-visible-reduced">
            <h1 className="splash-headline">all validation. no obligation.</h1>
            <p className="splash-subhead">no profile. no pressure. your matches are already waiting.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`splash-overlay splash-phase-${phase}`}>
      <div className="splash-pattern-base" />
      <div className="splash-pattern-layer splash-pattern-diagonal" />
      <div className="splash-pattern-layer splash-pattern-dots" />
      <div className="splash-pattern-layer splash-pattern-glow" />

      <div className="splash-emoji-layer splash-emoji-back" aria-hidden="true">
        {backEmojis.map((e) => (
          <span
            key={e.id}
            className="splash-emoji"
            style={{
              "--x": `${e.x}vw`,
              "--y": `${e.y}vh`,
              "--size": `${e.size}px`,
              "--delay": `${e.delay}ms`,
              "--duration": `${e.duration}ms`,
              "--rotation": `${e.rotation}deg`,
            } as React.CSSProperties}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <div className="splash-content">
        <div className={`splash-logo ${phase === "logo" || phase === "overwhelm" ? "splash-logo-active" : ""} ${phase === "overwhelm" ? "splash-logo-fade" : ""}`}>
          <div className="splash-logo-text">All Matches</div>
        </div>

        <div className={`splash-card-container ${phase === "card" ? "splash-card-visible" : ""} ${phase === "wipe" || phase === "exit" ? "splash-card-hidden" : ""}`}>
          <div className="splash-card">
            <h1 className="splash-headline">all validation. no obligation.</h1>
            <p className="splash-subhead">no profile. no pressure. your matches are already waiting.</p>
          </div>
        </div>
      </div>

      <div className="splash-emoji-layer splash-emoji-front" aria-hidden="true">
        {frontEmojis.map((e) => (
          <span
            key={e.id}
            className="splash-emoji"
            style={{
              "--x": `${e.x}vw`,
              "--y": `${e.y}vh`,
              "--size": `${e.size}px`,
              "--delay": `${e.delay}ms`,
              "--duration": `${e.duration}ms`,
              "--rotation": `${e.rotation}deg`,
            } as React.CSSProperties}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <div className={`splash-wipe-layer ${phase === "wipe" || phase === "exit" ? "splash-wipe-active" : ""}`} aria-hidden="true">
        {emojis.slice(0, 30).map((e, i) => (
          <span
            key={`wipe-${e.id}`}
            className="splash-wipe-emoji"
            style={{
              "--x": `${(i % 6) * 18 + Math.random() * 10}vw`,
              "--delay": `${i * 15}ms`,
              "--size": `${e.size + 8}px`,
            } as React.CSSProperties}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <div className={`splash-exit-layer ${phase === "exit" ? "splash-exit-active" : ""}`} />
    </div>
  );
}
