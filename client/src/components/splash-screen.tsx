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
  zIndex: number;
  settled: boolean;
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
  const [logoPos, setLogoPos] = useState({ x: 0, y: -100, vy: 0, rotation: 0, visible: false });
  const [cardPos, setCardPos] = useState({ y: 0, vy: 0, rotation: 0 });

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
    let currentFloorY = h + 100;
    let targetFloorY = h * 0.15; // Floor rises to 15% from top - creating a wall
    let gravity = 0.18;
    let hasFloor = true;
    let draining = false;
    let nextZIndex = 1000;
    let logoVisible = false;
    let cardDraining = false;

    const spawnEmojis = (count: number, staggered: boolean = true) => {
      const newEmojis: EmojiData[] = [];
      // Create a dense grid of emojis to ensure full coverage
      const cols = Math.ceil(w / 45);
      const rows = Math.ceil(h / 40) + 8;
      
      for (let i = 0; i < count; i++) {
        const size = 42 + Math.random() * 22;
        // Grid-based spawn with randomization for natural look
        const col = i % cols;
        const row = Math.floor(i / cols);
        const baseX = (col + 0.5) * (w / cols);
        const baseY = -size - row * 50 - Math.random() * 30;
        
        newEmojis.push({
          id: Date.now() + i + Math.random() * 10000,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          x: baseX + (Math.random() - 0.5) * 30,
          y: staggered ? baseY : -size - Math.random() * h * 0.6,
          vx: (Math.random() - 0.5) * 1,
          vy: 0.8 + Math.random() * 1.2,
          size,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 1.5,
          zIndex: nextZIndex++,
          settled: false,
        });
      }
      emojisRef.current = [...emojisRef.current, ...newEmojis];
    };

    const clearEmojis = () => {
      emojisRef.current = [];
      nextZIndex = 1000;
    };

    let logoY = -120;
    let logoVy = 0;
    let logoRotation = 0;
    let logoTargetY = h * 0.38;

    let cardY = 0;
    let cardVy = 0;
    let cardRotation = 0;

    const animate = () => {
      const emojis = emojisRef.current;

      // Gradually raise floor to create wall effect
      if (hasFloor && !draining) {
        currentFloorY += (targetFloorY - currentFloorY) * 0.02;
      }

      for (const e of emojis) {
        if (e.settled && hasFloor) {
          // Settled emojis don't move much
          e.vx *= 0.85;
          e.vy *= 0.85;
          e.rotationSpeed *= 0.9;
          
          // Push up with floor
          if (e.y > currentFloorY - e.size * 0.3) {
            e.y = currentFloorY - e.size * 0.3;
          }
        } else {
          e.vy += gravity;
          e.vy = Math.min(e.vy, 7); // Terminal velocity
        }
        
        e.x += e.vx;
        e.y += e.vy;
        e.rotation += e.rotationSpeed;

        // Wall bounce - keep emojis on screen
        if (e.x < e.size * 0.3) { e.x = e.size * 0.3; e.vx *= -0.2; }
        if (e.x > w - e.size * 0.3) { e.x = w - e.size * 0.3; e.vx *= -0.2; }

        // Floor collision - stack up
        if (hasFloor && e.y + e.size * 0.3 > currentFloorY) {
          e.y = currentFloorY - e.size * 0.3;
          e.vy *= -0.1;
          e.vx *= 0.8;
          e.rotationSpeed *= 0.6;
          if (Math.abs(e.vy) < 0.8) {
            e.settled = true;
            // Lower z-index when settled (creates depth - earlier emojis behind)
            e.zIndex = Math.max(1, e.zIndex - 600);
          }
        }
      }

      // Logo physics
      if (logoVisible) {
        if (!draining) {
          // Gentle fall and bob
          logoVy += gravity * 0.7;
          logoVy *= 0.96; // Damping
          logoY += logoVy;
          
          // Stop at target with gentle bounce
          if (logoY > logoTargetY) {
            logoY = logoTargetY;
            logoVy *= -0.15;
          }
          
          // Very minimal rotation - mostly straight
          logoRotation += logoVy * 0.05;
          logoRotation *= 0.9;
        } else {
          // Draining - fall with emojis
          logoVy += gravity * 1.5;
          logoY += logoVy;
          logoRotation += logoVy * 0.12;
        }
      }

      // Card physics during drain2
      if (cardDraining) {
        cardVy += gravity * 1.0;
        cardY += cardVy;
        cardRotation += cardVy * 0.08;
      }

      setLogoPos({ x: w / 2, y: logoY, vy: logoVy, rotation: logoRotation, visible: logoVisible });
      setCardPos({ y: cardY, vy: cardVy, rotation: cardRotation });
      setEmojiRender([...emojis]);

      rafRef.current = requestAnimationFrame(animate);
    };

    // Start emojis falling immediately - enough to cover screen
    spawnEmojis(350, true);
    rafRef.current = requestAnimationFrame(animate);

    const timers: number[] = [];
    const setT = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // Logo appears after emojis have started piling
    setT(1500, () => {
      logoVisible = true;
    });

    setT(3000, () => setPhase("logoBob"));

    setT(5000, () => {
      setPhase("drain1");
      draining = true;
      hasFloor = false;
      gravity = 0.35;
    });

    // Card is already visible behind emojis - just clear emojis to reveal
    setT(6200, () => {
      setPhase("cardHold");
      clearEmojis();
      draining = false;
      logoVisible = false;
    });

    setT(8000, () => {
      setPhase("flood2");
      hasFloor = true;
      currentFloorY = h + 100;
      targetFloorY = h * 0.15;
      gravity = 0.2;
      spawnEmojis(350, false);
    });

    setT(10500, () => {
      setPhase("drain2");
      draining = true;
      cardDraining = true;
      hasFloor = false;
      gravity = 0.4;
    });

    setT(12500, () => setPhase("done"));
    setT(13000, safeDismiss);

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
  // Card is always visible - emojis cover/reveal it
  const showCard = true;
  const emojisAboveCard = phase !== "cardHold"; // Emojis in front except during card hold

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
              zIndex: e.zIndex,
            }}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <div
        ref={logoElRef}
        className={`am-logo-card-sharp ${logoPos.visible && showLogo ? "am-visible" : "am-hidden"}`}
        style={{
          left: logoPos.x,
          top: logoPos.y,
          transform: `translate(-50%, -50%) rotate(${logoPos.rotation}deg)`,
        }}
      >
        <span className="am-logo-text">All Matches!</span>
      </div>

      <div 
        className={`am-tagline-wrap ${showCard ? "am-visible" : "am-hidden"}`}
        style={{
          transform: `translateY(${cardPos.y}px) rotate(${cardPos.rotation}deg)`,
        }}
      >
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
