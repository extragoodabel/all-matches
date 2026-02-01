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
  const [fadingOut, setFadingOut] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [logoPos, setLogoPos] = useState({ x: 0, y: -100, vy: 0, rotation: 0, visible: false });
  const [cardPos, setCardPos] = useState({ y: 0, vy: 0, rotation: 0, opacity: 0 });

  const safeDismiss = useCallback(() => {
    if (dismissed) return;
    setFadingOut(true);
    // Wait for fade animation, then complete
    setTimeout(() => {
      setDismissed(true);
      onComplete();
    }, 400);
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
    let gravity = 0.2;
    let hasFloor = true;
    let draining = false;
    let nextZIndex = 1000;
    let logoVisible = false;
    let cardDraining = false;
    let cardOpacity = 0;

    // Grid to track where emojis have settled for proper stacking
    const gridCols = Math.ceil(w / 35);
    const stackHeights: number[] = new Array(gridCols).fill(h);

    const spawnEmojis = (count: number, staggered: boolean = true, waterfall: boolean = false) => {
      const newEmojis: EmojiData[] = [];
      
      for (let i = 0; i < count; i++) {
        const size = 38 + Math.random() * 26;
        const x = (Math.random() * w * 0.96) + w * 0.02;
        let spawnDelay: number;
        if (waterfall) {
          spawnDelay = Math.random() * 2000;
        } else if (staggered) {
          spawnDelay = Math.random() * 800; // Quick thick wave
        } else {
          spawnDelay = Math.random() * 500; // Fast second wave
        }
        const y = -size - spawnDelay;
        
        newEmojis.push({
          id: Date.now() + i + Math.random() * 10000,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          x,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 5 + Math.random() * 4,
          size,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 4,
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

      for (const e of emojis) {
        // Once settled, emoji is LOCKED in place forever (until drain)
        if (e.settled && hasFloor) {
          // Completely frozen - no movement at all
          continue;
        }
        
        if (!e.settled) {
          e.vy += gravity;
          e.vy = Math.min(e.vy, 10); // Terminal velocity
          
          e.x += e.vx;
          e.y += e.vy;
          e.rotation += e.rotationSpeed;

          // Wall bounce
          if (e.x < e.size * 0.4) { e.x = e.size * 0.4; e.vx *= -0.3; }
          if (e.x > w - e.size * 0.4) { e.x = w - e.size * 0.4; e.vx *= -0.3; }

          // Collision with other settled emojis - check all settled emojis
          let hitSettled = false;
          for (const other of emojis) {
            if (other === e || !other.settled) continue;
            
            const dx = e.x - other.x;
            const dy = e.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = (e.size + other.size) * 0.28; // Slightly less overlap
            
            if (dist < minDist && e.y < other.y + other.size * 0.25) {
              // Land on top of this emoji
              e.y = other.y - minDist * 0.75;
              hitSettled = true;
              break;
            }
          }
          
          // Floor collision
          if (e.y + e.size * 0.3 > h) {
            e.y = h - e.size * 0.3;
            hitSettled = true;
          }
          
          if (hitSettled) {
            e.settled = true;
            e.vx = 0;
            e.vy = 0;
            e.rotationSpeed = 0;
            // Lower z-index when settled (behind newer emojis)
            e.zIndex = Math.max(1, e.zIndex - 500);
          }
        }
        
        // When draining, let settled emojis fall OFF screen quickly
        if (!hasFloor && e.settled) {
          e.settled = false;
          e.vy = 6 + Math.random() * 6; // Faster drain
          e.vx = (Math.random() - 0.5) * 0.8;
        }
      }
      
      // Remove emojis that have fallen off screen
      emojisRef.current = emojis.filter(e => e.y < h + 150);
      
      // Check if screen is covered (enough settled emojis)
      const settledCount = emojis.filter(e => e.settled).length;
      if (settledCount > 800 && cardOpacity === 0) {
        cardOpacity = 1;
      }

      // Logo physics - playful plop with bounce
      if (logoVisible) {
        if (!draining) {
          logoVy += gravity * 1.5;
          logoVy *= 0.94;
          logoY += logoVy;
          
          if (logoY > logoTargetY) {
            logoY = logoTargetY;
            logoVy *= -0.4; // Playful bounce
          }
          
          logoRotation += logoVy * 0.08;
          logoRotation *= 0.88;
        } else {
          // Draining - rush off screen
          logoVy += gravity * 2;
          logoY += logoVy;
          logoRotation += logoVy * 0.15;
        }
      }

      // Card physics during drain2
      if (cardDraining) {
        cardVy += gravity * 1.2;
        cardY += cardVy;
        cardRotation += cardVy * 0.06;
      }

      setLogoPos({ x: w / 2, y: logoY, vy: logoVy, rotation: logoRotation, visible: logoVisible });
      setCardPos({ y: cardY, vy: cardVy, rotation: cardRotation, opacity: cardOpacity });
      setEmojiRender([...emojis]);

      rafRef.current = requestAnimationFrame(animate);
    };

    // Start emojis falling immediately - quadrupled to cover screen
    spawnEmojis(1400, true);
    rafRef.current = requestAnimationFrame(animate);

    const timers: number[] = [];
    const setT = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // PHASE 1: Emojis flood in first (wall builds before logo)
    // Logo waits until wall is mostly built
    setT(1200, () => {
      logoVisible = true;
    });

    // Logo bobs in place - give time to read
    setT(2800, () => setPhase("logoBob"));

    // PHASE 2: Everything rushes off screen FAST
    setT(4500, () => {
      setPhase("drain1");
      draining = true;
      hasFloor = false;
      gravity = 0.8; // Very fast drain
    });

    // Card revealed - brief pause
    setT(5800, () => {
      setPhase("cardHold");
      logoVisible = false;
    });

    // PHASE 3: Second wave floods in FAST and wipes card (2 sec after card reveal)
    setT(6300, () => {
      setPhase("flood2");
      hasFloor = false;
      gravity = 0.6;
      cardDraining = true;
      spawnEmojis(1000, false, false); // Fast flood
    });

    // PHASE 4: Flashy outro - after second wave has washed over
    setT(8000, () => {
      setPhase("done");
      setFadingOut(true);
    });
    setT(8400, safeDismiss);

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
    <div ref={overlayRef} className={`am-splash-overlay ${fadingOut ? "am-fading-out" : ""}`}>
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
        className="am-tagline-wrap"
        style={{
          transform: `translateY(${cardPos.y}px) rotate(${cardPos.rotation}deg)`,
          opacity: cardPos.opacity,
          transition: 'opacity 0.3s ease',
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
