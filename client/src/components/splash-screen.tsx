import { useCallback, useEffect, useRef, useState } from "react";
import { AllMatchesLogo } from "./all-matches-logo";

type Phase = "flood1" | "logoBob" | "drain1" | "cardHold" | "flood2" | "drain2" | "done";

interface SplashScreenProps {
  onComplete: () => void;
}

const EMOJIS = [
  "💉", "💊", "❤️", "🧡", "💛", "💚", "💙", "💜", "💖",
  "💘", "💝", "💕", "💞", "💓", "💗", "💄", "💋", "🫦", "💅", "👠",
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
  // Landing animation
  scaleX: number;
  scaleY: number;
  landingTime: number | null; // timestamp when landing started
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
  const [logoPos, setLogoPos] = useState({ x: 0, y: -100, vy: 0, rotation: 0, visible: false, scaleX: 1, scaleY: 1 });
  const [cardPos, setCardPos] = useState({ y: 0, vy: 0, rotation: 0, opacity: 0 });

  const safeDismiss = useCallback(() => {
    if (dismissed) return;
    setFadingOut(true);
    // Wait for fade animation to complete
    setTimeout(() => {
      setDismissed(true);
      onComplete();
    }, 600);
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
    const isMobile = w < 768;
    const emojiMultiplier = isMobile ? 0.35 : 1; // 35% emojis on mobile
    let gravity = 0.2;
    let hasFloor = true;
    let draining = false;
    let logoDraining = false; // Logo starts draining slightly after emojis
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
        const size = 50 + Math.random() * 40; // Larger emojis
        const x = (Math.random() * w * 0.96) + w * 0.02;
        let spawnDelay: number;
        if (waterfall) {
          spawnDelay = Math.random() * 1800;
        } else if (staggered) {
          spawnDelay = Math.random() * 700;
        } else {
          spawnDelay = Math.random() * 400;
        }
        const y = -size - spawnDelay;
        
        newEmojis.push({
          id: Date.now() + i + Math.random() * 10000,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          x,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 6 + Math.random() * 5,
          size,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 4,
          zIndex: nextZIndex++,
          settled: false,
          scaleX: 1,
          scaleY: 1,
          landingTime: null,
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
    let logoScaleX = 1;
    let logoScaleY = 1;
    let logoLanded = false;
    let logoLandTime: number | null = null;

    let cardY = 0;
    let cardVy = 0;
    let cardRotation = 0;

    const animate = () => {
      const emojis = emojisRef.current;

      const now = performance.now();
      
      for (const e of emojis) {
        // Once settled, emoji is LOCKED in place forever (until drain)
        if (e.settled && hasFloor) {
          // Animate landing squash/stretch with bounce back to normal
          if (e.landingTime !== null) {
            const elapsed = now - e.landingTime;
            const duration = 450;
            if (elapsed < duration) {
              const progress = elapsed / duration;
              
              // Phase 1: Squash (0-15%)
              // Phase 2: Bounce up and stretch tall (15-50%)
              // Phase 3: Return to normal (50-100%)
              if (progress < 0.15) {
                // Initial squash
                const squashProgress = progress / 0.15;
                e.scaleX = 1 + 0.35 * squashProgress;
                e.scaleY = 1 - 0.45 * squashProgress;
              } else if (progress < 0.5) {
                // Bounce up - stretch vertically
                const bounceProgress = (progress - 0.15) / 0.35;
                const bounce = Math.sin(bounceProgress * Math.PI);
                e.scaleX = 1.35 - 0.45 * bounceProgress;
                e.scaleY = 0.55 + 0.55 * bounceProgress + 0.15 * bounce;
              } else {
                // Settle back to normal
                const settleProgress = (progress - 0.5) / 0.5;
                const ease = 1 - Math.pow(1 - settleProgress, 2);
                e.scaleX = 0.9 + 0.1 * ease;
                e.scaleY = 1.1 - 0.1 * ease;
              }
            } else {
              e.scaleX = 1;
              e.scaleY = 1;
              e.landingTime = null; // Animation complete
            }
          }
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
            // Start landing animation
            e.landingTime = performance.now();
            e.scaleX = 1;
            e.scaleY = 1;
          }
        }
        
        // When draining, let settled emojis fall OFF screen quickly
        if (!hasFloor && e.settled) {
          e.settled = false;
          e.vy = 6 + Math.random() * 6; // Faster drain
          e.vx = (Math.random() - 0.5) * 0.8;
        }
      }
      
      // Remove emojis that have fallen off screen (clean up for performance)
      emojisRef.current = emojis.filter(e => e.y < h + 100);
      
      // Card opacity is controlled by timer, not settled count

      // Logo physics - gentle natural drop with landing bounce
      if (logoVisible) {
        if (!draining) {
          logoVy += gravity * 0.9; // Even slower fall
          logoVy *= 0.97;
          logoY += logoVy;
          
          if (logoY > logoTargetY) {
            logoY = logoTargetY;
            
            // First landing - trigger bounce animation
            if (!logoLanded) {
              logoLanded = true;
              logoLandTime = now;
              logoScaleX = 1.20;
              logoScaleY = 0.75;
            }
            
            logoVy *= -0.55; // More pronounced upward bounce
          }
          
          // Animate logo landing squash/stretch
          if (logoLanded && logoLandTime !== null) {
            const elapsed = now - logoLandTime;
            const duration = 300; // Longer for more visible effect
            if (elapsed < duration) {
              const progress = elapsed / duration;
              // Ease out with slight overshoot for bouncy feel
              const easeOut = 1 - Math.pow(1 - progress, 3);
              logoScaleX = 1.20 - 0.20 * easeOut;
              logoScaleY = 0.75 + 0.25 * easeOut;
            } else {
              logoScaleX = 1;
              logoScaleY = 1;
              logoLandTime = null;
            }
          }
          
          // No rotation during drop
          logoRotation = 0;
        } else if (draining) {
          // Draining - falls off screen
          if (isMobile) {
            // Mobile: original faster drain behavior
            logoVy += gravity * 2;
            logoY += logoVy;
            logoRotation += logoVy * 0.15;
          } else if (logoDraining) {
            // Desktop: falls with emojis at same speed with slight delay
            logoVy += gravity * 0.5;
            logoY += logoVy;
            logoRotation += logoVy * 0.02;
          }
        }
      }

      // Card physics during drain2
      if (cardDraining) {
        cardVy += gravity * 1.2;
        cardY += cardVy;
        cardRotation += cardVy * 0.06;
      }

      setLogoPos({ x: w / 2, y: logoY, vy: logoVy, rotation: logoRotation, visible: logoVisible, scaleX: logoScaleX, scaleY: logoScaleY });
      setCardPos({ y: cardY, vy: cardVy, rotation: cardRotation, opacity: cardOpacity });
      setEmojiRender([...emojis]);

      rafRef.current = requestAnimationFrame(animate);
    };

    // Start emojis falling - fewer but larger for performance
    spawnEmojis(Math.floor(500 * emojiMultiplier), true);
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
    
    // Logo starts falling slightly after emojis (150ms delay)
    setT(4650, () => {
      logoDraining = true;
    });

    // Card revealed - delayed 2 seconds from original timing
    setT(5800, () => {
      setPhase("cardHold");
      logoVisible = false;
    });
    
    // Card opacity - appears shortly after drain starts
    setT(5000, () => {
      cardOpacity = 1;
    });

    // PHASE 3: Progressive second wave - starts IMMEDIATELY after drain
    // Stage 1: Random sprinkle (a few emojis)
    setT(5200, () => {
      setPhase("flood2");
      hasFloor = false;
      gravity = 0.5;
      spawnEmojis(Math.floor(20 * emojiMultiplier), false, true); // Light sprinkle
    });

    // Stage 2: Light rain - continues through the deluge
    setT(5600, () => {
      spawnEmojis(Math.floor(40 * emojiMultiplier), false, true); // Initial rain
    });
    setT(6500, () => {
      spawnEmojis(Math.floor(30 * emojiMultiplier), false, true); // Continuing rain
    });
    setT(7500, () => {
      spawnEmojis(Math.floor(30 * emojiMultiplier), false, true); // More continuing rain
    });
    setT(8500, () => {
      spawnEmojis(Math.floor(40 * emojiMultiplier), false, true); // Rain intensifies before deluge
    });

    // Stage 3: Full wave that pulls card off (give time to read - 4 seconds of card visibility)
    setT(9000, () => {
      spawnEmojis(Math.floor(200 * emojiMultiplier), false, false); // Full wave deluge
    });
    
    // Card falls WITH the deluge - delayed so wave hits first
    setT(9800, () => {
      cardDraining = true;
    });

    // Stage 4: Extra flood
    setT(9400, () => {
      spawnEmojis(Math.floor(150 * emojiMultiplier), false, false);
    });

    // PHASE 4: Flashy outro
    setT(12000, () => {
      setPhase("done");
      setFadingOut(true);
    });
    setT(12400, safeDismiss);

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
            <AllMatchesLogo variant="static" className="am-logo-svg" />
          </div>
          <div className="am-tagline-card">
            <div className="am-tagline-inner">
              <p className="am-tagline-line am-tagline-primary">ALL VALIDATION.</p>
              <p className="am-tagline-line am-tagline-primary">NO OBLIGATION.</p>
              <p className="am-tagline-line am-tagline-secondary">No profile? No problem!</p>
              <p className="am-tagline-line am-tagline-secondary">Your matches are already waiting.</p>
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
              transform: `translate(-50%, -50%) rotate(${e.rotation}deg) scale(${e.scaleX}, ${e.scaleY})`,
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
          transform: `translate(-50%, -50%) rotate(${logoPos.rotation}deg) scale(${logoPos.scaleX}, ${logoPos.scaleY})`,
        }}
      >
        <AllMatchesLogo variant="static" className="am-logo-svg" />
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
            <p className="am-tagline-line am-tagline-primary">ALL VALIDATION.</p>
            <p className="am-tagline-line am-tagline-primary">NO OBLIGATION.</p>
            <p className="am-tagline-line am-tagline-secondary">No profile? No problem!</p>
            <p className="am-tagline-line am-tagline-secondary">Your matches are already waiting.</p>
          </div>
        </div>
      </div>

      <div className="am-chyron">21+</div>
    </div>
  );
}
