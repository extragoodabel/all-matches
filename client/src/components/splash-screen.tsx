import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";

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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoElRef = useRef<HTMLDivElement>(null);

  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const rafRef = useRef<number | null>(null);
  const logoBodyRef = useRef<Matter.Body | null>(null);
  const emojiBodiesRef = useRef<Matter.Body[]>([]);
  const dprRef = useRef(1);

  const [phase, setPhase] = useState<Phase>("flood1");
  const [dismissed, setDismissed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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

    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    dprRef.current = dpr;

    const cssW = overlay.clientWidth;
    const cssH = overlay.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const w = canvas.width;
    const h = canvas.height;

    // Create physics engine
    const engine = Matter.Engine.create({ enableSleeping: false });
    engine.gravity.y = 0.95;
    engineRef.current = engine;

    // Create boundaries
    const thickness = 80;
    const walls = [
      Matter.Bodies.rectangle(-thickness / 2, h / 2, thickness, h * 2, { isStatic: true }),
      Matter.Bodies.rectangle(w + thickness / 2, h / 2, thickness, h * 2, { isStatic: true }),
      Matter.Bodies.rectangle(w / 2, -thickness / 2, w * 2, thickness, { isStatic: true }),
      Matter.Bodies.rectangle(w / 2, h + thickness / 2, w * 2, thickness, { isStatic: true, label: "floor" }),
    ];
    Matter.Composite.add(engine.world, walls);

    // Start runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Spawn emojis function
    const spawnEmojis = () => {
      const count = clamp(Math.round((w * h) / 6500), 100, 200);
      const minR = Math.round(Math.min(w, h) * 0.025);
      const maxR = Math.round(Math.min(w, h) * 0.04);

      const bodies: Matter.Body[] = [];
      const halfCount = Math.floor(count / 2);

      // Spawn from left side
      for (let i = 0; i < halfCount; i++) {
        const r = minR + Math.random() * (maxR - minR);
        const x = -r * 2 - Math.random() * w * 0.3;
        const y = h * 0.2 + Math.random() * h * 0.6;
        const body = Matter.Bodies.circle(x, y, r, {
          restitution: 0.2,
          friction: 0.3,
          frictionAir: 0.02,
          density: 0.002,
        });
        (body as any).emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        (body as any).radius = r;
        bodies.push(body);
      }

      // Spawn from right side
      for (let i = 0; i < count - halfCount; i++) {
        const r = minR + Math.random() * (maxR - minR);
        const x = w + r * 2 + Math.random() * w * 0.3;
        const y = h * 0.2 + Math.random() * h * 0.6;
        const body = Matter.Bodies.circle(x, y, r, {
          restitution: 0.2,
          friction: 0.3,
          frictionAir: 0.02,
          density: 0.002,
        });
        (body as any).emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        (body as any).radius = r;
        bodies.push(body);
      }

      Matter.Composite.add(engine.world, bodies);
      emojiBodiesRef.current = bodies;

      // Apply inward velocity
      bodies.forEach((b) => {
        const isLeft = b.position.x < w / 2;
        const speed = 12 + Math.random() * 4;
        Matter.Body.setVelocity(b, {
          x: isLeft ? speed : -speed,
          y: (Math.random() - 0.5) * 2,
        });
      });
    };

    // Canvas rendering
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFrame = () => {
      // Draw background
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#ff3bd4");
      grad.addColorStop(0.5, "#7c3aed");
      grad.addColorStop(1, "#00e5ff");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw pattern
      ctx.globalAlpha = 0.15;
      ctx.save();
      ctx.translate(w * 0.1, 0);
      ctx.rotate(-0.3);
      for (let i = -h; i < w + h; i += 60) {
        ctx.fillStyle = i % 120 === 0 ? "#fff" : "#000";
        ctx.fillRect(i, 0, 25, h * 2);
      }
      ctx.restore();

      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#fff";
      for (let y = 0; y < h; y += 50) {
        for (let x = 0; x < w; x += 50) {
          ctx.beginPath();
          ctx.arc(x + (y % 100 === 0 ? 25 : 0), y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Draw emojis
      const bodies = emojiBodiesRef.current;
      
      // Debug: show emoji count on screen
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Bodies: ${bodies.length}`, 20, 20);
      
      if (bodies.length > 0) {
        const firstBody = bodies[0];
        ctx.fillText(`First: (${Math.round(firstBody.position.x)}, ${Math.round(firstBody.position.y)})`, 20, 60);
      }
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const body of bodies) {
        const { x, y } = body.position;
        
        // Draw a visible circle for each body
        ctx.fillStyle = "#FF00FF";
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        if (x < -100 || x > w + 100 || y < -100 || y > h + 100) continue;

        const emoji = (body as any).emoji || "💖";
        const r = (body as any).radius || 20;

        ctx.fillStyle = "#000000";
        ctx.font = `${Math.round(r * 2)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.fillText(emoji, x, y);
      }

      // Sync logo position
      const logoBody = logoBodyRef.current;
      const logoEl = logoElRef.current;
      if (logoBody && logoEl) {
        const px = logoBody.position.x / dpr;
        const py = logoBody.position.y / dpr;
        const angle = logoBody.angle;
        logoEl.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px) rotate(${angle}rad)`;
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    // Start animation
    rafRef.current = requestAnimationFrame(drawFrame);

    // Spawn initial flood
    setTimeout(spawnEmojis, 50);

    // Phase timers
    const timers: number[] = [];
    const setT = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    setT(1000, () => {
      setPhase("logoBob");
      // Create logo physics body
      const logoBody = Matter.Bodies.rectangle(w / 2, -100, 300 * dpr, 70 * dpr, {
        restitution: 0.3,
        friction: 0.2,
        frictionAir: 0.03,
        density: 0.0008,
      });
      logoBodyRef.current = logoBody;
      Matter.Composite.add(engine.world, logoBody);
      Matter.Body.setVelocity(logoBody, { x: 0, y: 10 });
    });

    setT(2000, () => {
      setPhase("drain1");
      // Remove floor and increase gravity
      const floor = Matter.Composite.allBodies(engine.world).find(b => b.label === "floor");
      if (floor) Matter.Composite.remove(engine.world, floor);
      engine.gravity.y = 2.5;
    });

    setT(3000, () => {
      setPhase("cardHold");
      // Remove logo body if still there
      if (logoBodyRef.current) {
        Matter.Composite.remove(engine.world, logoBodyRef.current);
        logoBodyRef.current = null;
      }
      // Clear remaining emojis
      emojiBodiesRef.current.forEach(b => {
        if (Matter.Composite.allBodies(engine.world).includes(b)) {
          Matter.Composite.remove(engine.world, b);
        }
      });
      emojiBodiesRef.current = [];
    });

    setT(5000, () => {
      setPhase("flood2");
      // Restore floor and gravity
      engine.gravity.y = 1.2;
      const floor = Matter.Bodies.rectangle(w / 2, h + 40, w * 2, 80, { isStatic: true, label: "floor" });
      Matter.Composite.add(engine.world, floor);
      // Spawn new emojis
      spawnEmojis();
    });

    setT(6000, () => {
      setPhase("drain2");
      const floor = Matter.Composite.allBodies(engine.world).find(b => b.label === "floor");
      if (floor) Matter.Composite.remove(engine.world, floor);
      engine.gravity.y = 3;
    });

    setT(7000, () => setPhase("done"));
    setT(7500, safeDismiss);

    return () => {
      timers.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current);
        Matter.Composite.clear(engineRef.current.world, false);
      }
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

  const showLogo = phase === "logoBob" || phase === "drain1";
  const showCard = phase === "cardHold" || phase === "flood2" || phase === "drain2";

  return (
    <div ref={overlayRef} className="am-splash-overlay">
      <canvas ref={canvasRef} className="am-splash-canvas" aria-hidden="true" />

      <div className="am-splash-content">
        <div
          ref={logoElRef}
          className={`am-logo-card ${showLogo ? "am-visible" : "am-hidden"}`}
          style={{ transform: "translate(-50%, -50%) translate(50vw, -100px)" }}
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
    </div>
  );
}
