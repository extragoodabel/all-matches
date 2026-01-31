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
    let floorY = h + 50;
    let gravity = 0.4;
    let hasFloor = true;

    const spawnEmojis = (count: number) => {
      const newEmojis: EmojiData[] = [];
      for (let i = 0; i < count; i++) {
        const size = 20 + Math.random() * 25;
        newEmojis.push({
          id: Date.now() + i + Math.random() * 10000,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          x: size + Math.random() * (w - size * 2),
          y: -size - Math.random() * h,
          vx: (Math.random() - 0.5) * 4,
          vy: 2 + Math.random() * 4,
          size,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
        });
      }
      emojisRef.current = [...emojisRef.current, ...newEmojis];
    };

    const clearEmojis = () => {
      emojisRef.current = [];
    };

    let logoY = -80;
    let logoVy = 3;
    let logoRotation = 0;

    const animate = () => {
      const emojis = emojisRef.current;

      for (const e of emojis) {
        e.vy += gravity;
        e.x += e.vx;
        e.y += e.vy;
        e.rotation += e.rotationSpeed;

        if (e.x < 0) { e.x = 0; e.vx *= -0.6; }
        if (e.x > w) { e.x = w; e.vx *= -0.6; }

        if (hasFloor && e.y + e.size / 2 > floorY) {
          e.y = floorY - e.size / 2;
          e.vy *= -0.4;
          e.vx *= 0.95;
        }
      }

      logoVy += gravity * 0.5;
      logoY += logoVy;
      logoRotation += logoVy * 0.3;

      if (hasFloor && logoY > h * 0.4) {
        logoY = h * 0.4;
        logoVy *= -0.3;
      }

      setLogoPos({ x: w / 2, y: logoY, vy: logoVy, rotation: logoRotation });
      setEmojiRender([...emojis]);

      rafRef.current = requestAnimationFrame(animate);
    };

    spawnEmojis(200);
    rafRef.current = requestAnimationFrame(animate);

    const timers: number[] = [];
    const setT = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    setT(1500, () => setPhase("logoBob"));

    setT(2500, () => {
      setPhase("drain1");
      hasFloor = false;
      gravity = 1.2;
    });

    setT(3500, () => {
      setPhase("cardHold");
      clearEmojis();
    });

    setT(5500, () => {
      setPhase("flood2");
      hasFloor = true;
      gravity = 0.5;
      spawnEmojis(200);
    });

    setT(6500, () => {
      setPhase("drain2");
      hasFloor = false;
      gravity = 1.5;
    });

    setT(7500, () => setPhase("done"));
    setT(8000, safeDismiss);

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

  return (
    <div ref={overlayRef} className="am-splash-overlay">
      <div className="am-splash-bg" />

      <div className="am-emoji-layer">
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
