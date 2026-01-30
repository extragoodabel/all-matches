import { useEffect, useState, useMemo } from "react";

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  velocityX: number;
  velocityY: number;
  delay: number;
  bounces: boolean;
  floatsFirst: boolean;
}

const ICONS = [
  { emoji: "❤️", weight: 5 },
  { emoji: "💊", weight: 3 },
  { emoji: "🎈", weight: 2 },
  { emoji: "💉", weight: 1 },
  { emoji: "➡️", weight: 2 },
];

function getRandomIcon(): string {
  const totalWeight = ICONS.reduce((sum, icon) => sum + icon.weight, 0);
  let random = Math.random() * totalWeight;
  for (const icon of ICONS) {
    random -= icon.weight;
    if (random <= 0) return icon.emoji;
  }
  return "❤️";
}

function generateParticles(count: number, isSpecial: boolean): Particle[] {
  const particles: Particle[] = [];
  const centerX = 50;
  const centerY = 40;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 8 + Math.random() * 12;
    const isOversized = isSpecial && i === 0;

    particles.push({
      id: i,
      emoji: getRandomIcon(),
      x: centerX + (Math.random() - 0.5) * 10,
      y: centerY + (Math.random() - 0.5) * 10,
      size: isOversized ? 64 + Math.random() * 32 : 20 + Math.random() * 24,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 720,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 5,
      delay: Math.random() * 100,
      bounces: Math.random() > 0.7,
      floatsFirst: Math.random() > 0.8,
    });
  }

  return particles;
}

interface DopamineConfettiProps {
  onComplete?: () => void;
}

export function DopamineConfetti({ onComplete }: DopamineConfettiProps) {
  const [phase, setPhase] = useState<"pulse" | "explode" | "fall" | "done">("pulse");
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const isSpecialMatch = useMemo(() => Math.random() < 0.1, []);
  const particles = useMemo(
    () => generateParticles(prefersReducedMotion ? 8 : 30, isSpecialMatch),
    [prefersReducedMotion, isSpecialMatch]
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 400);
      return () => clearTimeout(timer);
    }

    const pulseTimer = setTimeout(() => setPhase("explode"), 100);
    const explodeTimer = setTimeout(() => setPhase("fall"), 600);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      setVisible(false);
      onComplete?.();
    }, 1200);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(explodeTimer);
      clearTimeout(doneTimer);
    };
  }, [prefersReducedMotion, onComplete]);

  if (!visible) return null;

  if (prefersReducedMotion) {
    return (
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: "radial-gradient(circle at center, rgba(255,20,147,0.15) 0%, transparent 70%)",
          animation: "dopamine-fade 400ms ease-out forwards",
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <div
        className="absolute inset-0 transition-opacity duration-100"
        style={{
          background: phase === "pulse" 
            ? "radial-gradient(circle at center 40%, rgba(255,20,147,0.3) 0%, rgba(255,215,0,0.1) 40%, transparent 70%)"
            : "transparent",
          opacity: phase === "pulse" ? 1 : 0,
        }}
      />

      {particles.map((particle) => (
        <ParticleElement
          key={particle.id}
          particle={particle}
          phase={phase}
          isSpecial={isSpecialMatch}
        />
      ))}
    </div>
  );
}

interface ParticleElementProps {
  particle: Particle;
  phase: "pulse" | "explode" | "fall" | "done";
  isSpecial: boolean;
}

function ParticleElement({ particle, phase, isSpecial }: ParticleElementProps) {
  const [position, setPosition] = useState({ x: particle.x, y: particle.y });
  const [rotation, setRotation] = useState(particle.rotation);
  const [opacity, setOpacity] = useState(0);
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (phase === "pulse") {
      setOpacity(0);
      return;
    }

    if (phase === "explode") {
      setOpacity(1);
      const initialVelY = particle.floatsFirst ? -Math.abs(particle.velocityY) * 0.5 : particle.velocityY;
      setVelocity({ x: particle.velocityX, y: initialVelY });
    }

    let animationFrame: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setPosition((prev) => ({
        x: prev.x + velocity.x * deltaTime * 60,
        y: prev.y + velocity.y * deltaTime * 60,
      }));

      setVelocity((prev) => ({
        x: prev.x * 0.98,
        y: prev.y + 0.8,
      }));

      setRotation((prev) => prev + particle.rotationSpeed * deltaTime);

      if (phase === "fall") {
        setOpacity((prev) => Math.max(0, prev - deltaTime * 1.5));
      }

      animationFrame = requestAnimationFrame(animate);
    };

    if (phase === "explode" || phase === "fall") {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [phase, particle, velocity.x, velocity.y]);

  const filter = isSpecial && particle.id === 0 
    ? "drop-shadow(0 0 8px rgba(255,20,147,0.8))" 
    : "none";

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        fontSize: `${particle.size}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        opacity,
        filter,
        willChange: "transform, opacity, left, top",
      }}
    >
      {particle.emoji}
    </div>
  );
}
