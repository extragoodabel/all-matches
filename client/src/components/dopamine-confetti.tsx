import { useEffect, useState, useMemo, useCallback } from "react";

const PRIMARY_ICONS = [
  "❤️", "💘", "💕", "💗", "💖", "💝", "🩷", "💜", "✨", "⭐", "💫", 
  "💊", "💊", "💊", "🍾", "🍾", "🍾", "😬", "😬", "💋", "💋",
  "🔗", "🔗", "💄", "👠", "💍", "🌹", "🍬", "🍫"
];
const SECONDARY_ICONS = [
  "💊", "💊", "💊", "💉", "💉", "🍾", "🍾", "😬", "😬", 
  "🧪", "🧠", "🔥", "⚡", "💥", "🦩", "🍄", "🍒", "🌶️", "🍆", "💦", "🧨", "🩸", "🔗", "🔗"
];
const RARE_ICONS = ["💉", "💉", "🧬", "👁️", "🪞", "🧿", "🫀", "🎭", "🔗"];
const SUBLIMINAL_WORDS = ["MATCH", "VALIDATED", "SEEN", "REWARDED", "DOPAMINE", "SEROTONIN", "FEELS GOOD"];

function getRandomIcon(allowRare: boolean = true): string {
  const roll = Math.random();
  if (allowRare && roll < 0.12) {
    return RARE_ICONS[Math.floor(Math.random() * RARE_ICONS.length)];
  } else if (roll < 0.45) {
    return SECONDARY_ICONS[Math.floor(Math.random() * SECONDARY_ICONS.length)];
  }
  return PRIMARY_ICONS[Math.floor(Math.random() * PRIMARY_ICONS.length)];
}

interface FireworkParticle {
  id: number;
  emoji: string;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  delay: number;
}

interface ConfettiParticle {
  id: number;
  emoji: string;
  startX: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  fallSpeed: number;
  swayAmplitude: number;
  swayFrequency: number;
  delay: number;
  opacity: number;
}

interface BalloonParticle {
  id: number;
  emoji: string;
  startX: number;
  startY: number;
  riseSpeed: number;
  driftX: number;
  size: number;
  delay: number;
}

function generateFireworks(count: number): FireworkParticle[] {
  const particles: FireworkParticle[] = [];
  for (let i = 0; i < count; i++) {
    const burstIndex = Math.floor(i / (count / 4));
    const burstDelay = burstIndex * 200;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const speed = 14 + Math.random() * 12;
    particles.push({
      id: i,
      emoji: getRandomIcon(true),
      startX: 15 + Math.random() * 70,
      startY: 92 + Math.random() * 8,
      velocityX: Math.cos(angle) * speed * (0.4 + Math.random() * 0.6),
      velocityY: Math.sin(angle) * speed,
      size: 18 + Math.random() * 20,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 300,
      delay: burstDelay + Math.random() * 120,
    });
  }
  return particles;
}

function generateConfetti(count: number, allowRare: boolean): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      emoji: getRandomIcon(allowRare),
      startX: Math.random() * 100,
      size: 14 + Math.random() * 18,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 200,
      fallSpeed: 0.4 + Math.random() * 1.2,
      swayAmplitude: 15 + Math.random() * 25,
      swayFrequency: 0.8 + Math.random() * 1.2,
      delay: Math.random() * 1500,
      opacity: 0.85 + Math.random() * 0.15,
    });
  }
  return particles;
}

function generateBalloons(count: number): BalloonParticle[] {
  const particles: BalloonParticle[] = [];
  const balloonEmojis = ["🎈", "🎈", "💊", "💊", "🍾", "🍾", "💉", "🦩", "🍄", "🧠", "🔗", "😬"];
  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.5;
    particles.push({
      id: i,
      emoji: balloonEmojis[Math.floor(Math.random() * balloonEmojis.length)],
      startX: side ? 5 + Math.random() * 20 : 75 + Math.random() * 20,
      startY: 85 + Math.random() * 15,
      riseSpeed: 0.3 + Math.random() * 0.3,
      driftX: (Math.random() - 0.5) * 0.4,
      size: 28 + Math.random() * 16,
      delay: 600 + Math.random() * 400,
    });
  }
  return particles;
}

interface DopamineConfettiProps {
  onComplete?: () => void;
}

export function DopamineConfetti({ onComplete }: DopamineConfettiProps) {
  const [phase, setPhase] = useState<"pulse" | "active" | "done">("pulse");
  const [visible, setVisible] = useState(true);
  const [showSubliminal, setShowSubliminal] = useState(false);
  const [subliminalWord] = useState(() => 
    SUBLIMINAL_WORDS[Math.floor(Math.random() * SUBLIMINAL_WORDS.length)]
  );
  const [subliminalPosition] = useState(() => ({
    x: 40 + Math.random() * 20,
    y: 40 + Math.random() * 20,
    rotate: (Math.random() - 0.5) * 16,
  }));

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const fireworkCount = prefersReducedMotion ? 12 : 100 + Math.floor(Math.random() * 50);
  const confettiCount = prefersReducedMotion ? 50 : 200 + Math.floor(Math.random() * 80);
  const balloonCount = prefersReducedMotion ? 5 : 14 + Math.floor(Math.random() * 8);

  const fireworks = useMemo(() => generateFireworks(fireworkCount), [fireworkCount]);
  const confetti = useMemo(() => generateConfetti(confettiCount, !prefersReducedMotion), [confettiCount, prefersReducedMotion]);
  const balloons = useMemo(() => generateBalloons(balloonCount), [balloonCount]);

  useEffect(() => {
    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 800);
      return () => clearTimeout(timer);
    }

    const pulseTimer = setTimeout(() => setPhase("active"), 150);
    const subliminalStart = setTimeout(() => setShowSubliminal(true), 50);
    const subliminalEnd = setTimeout(() => setShowSubliminal(false), 280);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      setVisible(false);
      onComplete?.();
    }, 8000);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(subliminalStart);
      clearTimeout(subliminalEnd);
      clearTimeout(doneTimer);
    };
  }, [prefersReducedMotion, onComplete]);

  if (!visible) return null;

  if (prefersReducedMotion) {
    return (
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: "radial-gradient(circle at center 40%, rgba(255,20,147,0.2) 0%, transparent 60%)",
          animation: "dopamine-fade 800ms ease-out forwards",
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {showSubliminal && (
        <div 
          className="absolute"
          style={{
            left: `${subliminalPosition.x}%`,
            top: `${subliminalPosition.y}%`,
            transform: `translate(-50%, -50%) rotate(${subliminalPosition.rotate}deg)`,
            opacity: 0.32,
            fontSize: "9vw",
            fontWeight: 900,
            letterSpacing: "0.2em",
            color: "#FF1493",
            animation: "dopamine-flash 200ms ease-out",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            textShadow: "0 0 40px rgba(255,20,147,0.3)",
          }}
        >
          {subliminalWord}
        </div>
      )}

      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{
          background: phase === "pulse" 
            ? "radial-gradient(circle at center 45%, rgba(255,20,147,0.35) 0%, rgba(255,215,0,0.15) 30%, transparent 60%)"
            : "transparent",
          opacity: phase === "pulse" ? 1 : 0,
        }}
      />

      {phase === "active" && (
        <>
          {fireworks.map((p) => (
            <FireworkElement key={`fw-${p.id}`} particle={p} />
          ))}
          
          {confetti.map((p) => (
            <ConfettiElement key={`cf-${p.id}`} particle={p} />
          ))}
        </>
      )}
    </div>
  );
}

function FireworkElement({ particle }: { particle: FireworkParticle }) {
  const [pos, setPos] = useState({ x: particle.startX, y: particle.startY });
  const [vel, setVel] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(particle.rotation);
  const [opacity, setOpacity] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
      setOpacity(1);
      setVel({ x: particle.velocityX, y: particle.velocityY });
    }, particle.delay);

    return () => clearTimeout(startTimer);
  }, [particle]);

  useEffect(() => {
    if (!started) return;

    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.035);
      lastTime = currentTime;

      setVel((v) => ({
        x: v.x * 0.995,
        y: v.y + 0.06,
      }));

      setPos((p) => ({
        x: p.x + vel.x * dt * 18,
        y: p.y + vel.y * dt * 18,
      }));

      setRotation((r) => r + particle.rotationSpeed * dt);

      if (pos.y > 115) {
        return;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [started, vel, pos.y, particle.rotationSpeed]);

  if (pos.y > 115 && started) return null;

  return (
    <div
      className="absolute"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        fontSize: `${particle.size}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {particle.emoji}
    </div>
  );
}

function ConfettiElement({ particle }: { particle: ConfettiParticle }) {
  const [y, setY] = useState(-10);
  const [rotation, setRotation] = useState(particle.rotation);
  const [opacity, setOpacity] = useState(0);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
      setOpacity(particle.opacity);
    }, particle.delay);

    return () => clearTimeout(startTimer);
  }, [particle]);

  useEffect(() => {
    if (!started) return;

    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      setTime((t) => t + dt);
      setY((prevY) => prevY + particle.fallSpeed * dt * 35);
      setRotation((r) => r + particle.rotationSpeed * dt);

      if (y > 115) {
        return;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [started, y, particle.fallSpeed, particle.rotationSpeed]);

  if (y > 115 && started) return null;

  const swayX = particle.startX + Math.sin(time * particle.swayFrequency * 2) * particle.swayAmplitude * 0.3;

  return (
    <div
      className="absolute"
      style={{
        left: `${swayX}%`,
        top: `${y}%`,
        fontSize: `${particle.size}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {particle.emoji}
    </div>
  );
}

function BalloonElement({ particle }: { particle: BalloonParticle }) {
  const [pos, setPos] = useState({ x: particle.startX, y: particle.startY });
  const [opacity, setOpacity] = useState(0);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
      setOpacity(0.9);
    }, particle.delay);

    return () => clearTimeout(startTimer);
  }, [particle]);

  useEffect(() => {
    if (!started) return;

    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      setTime((t) => t + dt);
      
      setPos((p) => ({
        x: p.x + particle.driftX * dt * 20 + Math.sin(time * 0.8) * 0.1,
        y: p.y - particle.riseSpeed * dt * 25,
      }));

      if (pos.y < -15) {
        setOpacity(0);
        return;
      }

      if (pos.y < 10) {
        setOpacity((o) => Math.max(0, o - dt));
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [started, pos.y, time, particle.driftX, particle.riseSpeed]);

  if (opacity <= 0 && started) return null;

  return (
    <div
      className="absolute"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        fontSize: `${particle.size}px`,
        transform: "translate(-50%, -50%)",
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {particle.emoji}
    </div>
  );
}
