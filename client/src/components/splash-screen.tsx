import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "flood1" | "logoBob" | "drain1" | "cardHold" | "flood2" | "drain2" | "done";

interface SplashScreenProps {
  onComplete: () => void;
}

const EMOJIS = [
  "💉", "💊", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💖",
  "💘", "💝", "💕", "💞", "💓", "💗", "💟", "💄", "💋", "🫦", "💅", "👠",
  "💀", "🥂", "🍾", "🪞", "⛓️", "🍫", "🧿", "🩸", "💍", "🧬", "🌶️", "⚡",
  "💦", "🫀", "🧠", "⭐", "👁️", "🌟", "🍄", "🧨", "🍒", "🔥", "😬", "😍",
  "🎭", "🧪",
];

interface EmojiData {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoElRef = useRef<HTMLDivElement>(null);
  const emojisRef = useRef<EmojiData[]>([]);
  const rafRef = useRef<number | null>(null);
  const [emojiRender, setEmojiRender] = useState<EmojiData[]>([]);

  const [phase, setPhase] = useState<Phase>("flood1");
  const [dismissed, setDismissed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [logoPos, setLogoPos] = useState({ x: 0, y: -100, vy: 0, rotation: 0 });

  const safeDismiss = useCallback(() => {
    if (dismissed) return;
    setDismissed(true);
    onComplete();
  }, [dismissed, onComplete]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (dismissed || prefersReducedMotion) return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    let floorY = h - 20;
    let gravity = 0.15;
    let hasFloor = true;
    let draining = false;

    const spawnEmojis = (count: number, staggered: boolean = true) => {
      const newEmojis: EmojiData[] = [];
      for (let i = 0; i < count; i++) {
        const size = 35 + Math.random() * 30;
        newEmojis.push({
          id: Date.now() + i + Math.random() * 10000,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          x: size / 2 + Math.random() * (w - size),
          y: staggered ? -size - Math.random() * h * 1.5 : -size - Math.random() * h * 0.8,
          vx: (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 2,
          size,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 3,
        });
      }
      emojisRef.current = [...emojisRef.current, ...newEmojis];
    };

    const clearEmojis = () => {
      emojisRef.current = [];
    };

    let logoY = -100;
    let logoVy = 1.5;
    let logoRotation = 0;
    let logoTargetY = h * 0.35;

    const animate = () => {
      const emojis = emojisRef.current;

      // Sort by y position so lower emojis are processed first (for stacking)
      emojis.sort((a, b) => b.y - a.y);

      for (const e of emojis) {
        e.vy += gravity;
        e.vy = Math.min(e.vy, 8); // Terminal velocity
        e.x += e.vx;
        e.y += e.vy;
        e.rotation += e.rotationSpeed;

        // Wall bounce
        if (e.x < e.size / 2) { e.x = e.size / 2; e.vx *= -0.5; }
        if (e.x > w - e.size / 2) { e.x = w - e.size / 2; e.vx *= -0.5; }

        // Floor collision with stacking
        if (hasFloor) {
          // Find the highest emoji below this one in similar x range
          let effectiveFloor = floorY;
          for (const other of emojis) {
            if (other === e) continue;
            if (Math.abs(other.x - e.x) < (e.size + other.size) * 0.4) {
              if (other.y > e.y && other.y < effectiveFloor) {
                effectiveFloor = other.y - other.size * 0.6;
              }
            }
          }

          if (e.y + e.size / 2 > effectiveFloor) {
            e.y = effectiveFloor - e.size / 2;
            e.vy *= -0.25;
            e.vx *= 0.9;
            e.rotationSpeed *= 0.8;
          }
        }
      }

      // Logo physics - gentle bobbing
      if (!draining) {
        // Float toward target with gentle bobbing
        const diff = logoTargetY - logoY;
        logoVy += diff * 0.008;
        logoVy *= 0.96; // Damping
        logoY += logoVy;
        
        // Gentle rotation based on velocity
        logoRotation += logoVy * 0.5;
        logoRotation *= 0.98; // Dampen rotation back to center
      } else {
        // Draining - fall with emojis
        logoVy += gravity * 1.5;
        logoY += logoVy;
        logoRotation += logoVy * 0.8;
      }

      setLogoPos({ x: w / 2, y: logoY, vy: logoVy, rotation: logoRotation });
      setEmojiRender([...emojis]);

      rafRef.current = requestAnimationFrame(animate);
    };

    spawnEmojis(250, true);
    rafRef.current = requestAnimationFrame(animate);

    const timers: number[] = [];
    const setT = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    setT(2000, () => setPhase("logoBob"));

    setT(4000, () => {
      setPhase("drain1");
      draining = true;
      hasFloor = false;
      gravity = 0.3;
    });

    setT(5500, () => {
      setPhase("cardHold");
      clearEmojis();
      draining = false;
    });

    setT(7500, () => {
      setPhase("flood2");
      hasFloor = true;
      gravity = 0.2;
      spawnEmojis(250, false);
    });

    setT(9500, () => {
      setPhase("drain2");
      draining = true;
      hasFloor = false;
      gravity = 0.35;
    });

    setT(11500, () => setPhase("done"));
    setT(12000, safeDismiss);

    return () => {
      timers.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dismissed, prefersReducedMotion, safeDismiss]);

  if (dismissed) return null;

  if (prefersReducedMotion) {
    return (
      <div ref={overlayRef} className="am-splash-overlay">
        <div className="am-splash-bg" />
        <div className="am-splash-content">
          <div className="am-logo-card am-logo-card-static">
            <span className="am-logo-text">All Matches!</span>
          </div>
          <div className="am-tagline-card">
            <div className="am-tagline-inner">
              <h1 className="am-tagline-h">all validation. no obligation.</h1>
              <p className="am-tagline-p">no profile. no pressure. your matches are already waiting for you.</p>
            </div>
          </div>
          <div className="am-chyron">21+</div>
        </div>
      </div>
    );
  }

  const showLogo = phase === "flood1" || phase === "logoBob" || phase === "drain1";
  const showCard = phase === "cardHold" || phase === "flood2" || phase === "drain2";
  const emojisAboveCard = phase === "flood2" || phase === "drain2";

  return (
    <div ref={overlayRef} className="am-splash-overlay">
      <div className="am-splash-bg" />

      {/* Emoji layer - z-index changes based on phase */}
      <div className={`am-emoji-layer ${emojisAboveCard ? "am-emoji-layer-front" : ""}`}>
        {emojiRender.map((e) => (
          <span
            key={e.id}
            className="am-emoji"
            style={{
              left: e.x,
              top: e.y,
              fontSize: e.size,
              transform: `translate(-50%, -50%) rotate(${e.rotation}deg)`,
            }}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <div
        ref={logoElRef}
        className={`am-logo-card ${showLogo ? "am-visible" : "am-hidden"}`}
        style={{
          left: logoPos.x,
          top: logoPos.y,
          transform: `translate(-50%, -50%) rotate(${logoPos.rotation}deg)`,
        }}
      >
        <span className="am-logo-text">All Matches!</span>
      </div>

      <div className={`am-tagline-wrap ${showCard ? "am-visible" : "am-hidden"}`}>
        <div className="am-tagline-card">
          <div className="am-tagline-inner">
            <h1 className="am-tagline-h">all validation. no obligation.</h1>
            <p className="am-tagline-p">no profile. no pressure. your matches are already waiting for you.</p>
          </div>
        </div>
      </div>

      <div className="am-chyron">21+</div>
    </div>
  );
}
