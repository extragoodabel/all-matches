import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";

interface StarFireworkProps {
  color: string;
  secondaryColor: string;
}

export function StarFirework({ color, secondaryColor }: StarFireworkProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [sparks, setSparks] = useState<Array<{ id: number; angle: number; velocity: number; color: string; type: 'circle' | 'line'; delay: number }>>([]);
  const [phase, setPhase] = useState<"idle" | "spinning">("idle");
  
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const triggerAnimation = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setPhase("spinning");
    
    const sparkColors = [color, secondaryColor, '#FFD700', '#FF6B35', '#FF1493', '#FFFFFF', '#FFF700', '#00FFFF', '#FF0080'];
    const newSparks: typeof sparks = [];
    
    // MAXIMALIST electric line sparks that spiral clockwise
    for (let i = 0; i < 60; i++) {
      const baseAngle = (i / 60) * 360;
      const clockwiseOffset = (i % 12) * 12;
      newSparks.push({
        id: i,
        angle: baseAngle + clockwiseOffset + Math.random() * 40,
        velocity: 200 + Math.random() * 350,
        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        type: 'line',
        delay: (i % 12) * 0.03,
      });
    }
    
    // Big glowing circle sparks - MORE of them
    for (let i = 0; i < 40; i++) {
      const baseAngle = (i / 40) * 360;
      const clockwiseOffset = (i % 8) * 15;
      newSparks.push({
        id: 100 + i,
        angle: baseAngle + clockwiseOffset + Math.random() * 30,
        velocity: 150 + Math.random() * 300,
        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        type: 'circle',
        delay: (i % 8) * 0.04,
      });
    }
    
    setSparks(newSparks);

    setTimeout(() => {
      setPhase("idle");
      setSparks([]);
      setIsAnimating(false);
    }, prefersReducedMotion ? 400 : 1600);
  }, [isAnimating, color, secondaryColor, prefersReducedMotion]);

  return (
    <div className="relative inline-flex items-center justify-center cursor-pointer" onClick={triggerAnimation}>
      <motion.div
        animate={
          phase === "spinning"
            ? { rotate: prefersReducedMotion ? 360 : 1440, scale: [1, 1.3, 1.1, 1.2, 1] }
            : { rotate: 0, scale: 1 }
        }
        transition={
          phase === "spinning"
            ? { duration: prefersReducedMotion ? 0.4 : 1.4, ease: [0.2, 0, 0.2, 1] }
            : { duration: 0.3 }
        }
      >
        <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 md:w-9 md:h-9" style={{ color: secondaryColor }} />
      </motion.div>
      
      <AnimatePresence>
        {phase === "spinning" && sparks.map((spark) => (
          <motion.div
            key={spark.id}
            className="absolute"
            style={{ 
              width: spark.type === 'line' ? '4px' : '24px',
              height: spark.type === 'line' ? '28px' : '24px',
              borderRadius: spark.type === 'line' ? '2px' : '50%',
              background: spark.type === 'line' 
                ? `linear-gradient(to bottom, ${spark.color}, transparent)`
                : spark.color,
              boxShadow: spark.type === 'line'
                ? `0 0 6px ${spark.color}, 0 0 12px ${spark.color}`
                : `0 0 10px ${spark.color}, 0 0 20px ${spark.color}`,
              transformOrigin: 'center center',
            }}
            initial={{ 
              x: 0, 
              y: 0, 
              opacity: 1, 
              scale: spark.type === 'line' ? 1 : 1.5,
              rotate: spark.angle + 90,
            }}
            animate={{
              x: Math.cos((spark.angle * Math.PI) / 180) * spark.velocity,
              y: Math.sin((spark.angle * Math.PI) / 180) * spark.velocity + 30,
              opacity: 0,
              scale: spark.type === 'line' ? 0.5 : 0.2,
              rotate: spark.angle + 90 + 45,
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: spark.type === 'line' ? 0.9 : 1.3, 
              ease: "easeOut",
              delay: spark.delay,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface HeartKissProps {
  color: string;
  accentColor: string;
}

export function HeartKiss({ color, accentColor }: HeartKissProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [currentWord, setCurrentWord] = useState<number>(-1);
  
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  
  const words = ["I.", "LOVE.", "YOU."];

  const triggerAnimation = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowOverlay(true);
    setCurrentWord(-1);

    const wordDelay = prefersReducedMotion ? 150 : 220;
    
    setTimeout(() => setCurrentWord(0), prefersReducedMotion ? 200 : 400);
    setTimeout(() => setCurrentWord(1), prefersReducedMotion ? 350 : 620);
    setTimeout(() => setCurrentWord(2), prefersReducedMotion ? 500 : 840);

    setTimeout(() => {
      setShowOverlay(false);
      setCurrentWord(-1);
      setIsAnimating(false);
    }, prefersReducedMotion ? 1000 : 2200);
  }, [isAnimating, prefersReducedMotion]);

  return (
    <>
      <div 
        className="relative inline-flex items-center justify-center cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          triggerAnimation();
        }}
      >
        <motion.div
          animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <Heart className="w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10" style={{ color }} />
        </motion.div>
      </div>

      <AnimatePresence>
        {showOverlay && (
          <motion.div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="text-6xl mb-8"
              initial={{ y: -200, rotate: -20, scale: 0.5 }}
              animate={{ 
                y: 0, 
                rotate: 0, 
                scale: [0.5, 1.4, 1],
              }}
              transition={{ 
                duration: prefersReducedMotion ? 0.2 : 0.5, 
                ease: "easeOut",
                scale: { times: [0, 0.6, 1] }
              }}
            >
              💋
            </motion.div>

            <div className="flex flex-col items-center gap-3">
              {words.map((word, index) => (
                <AnimatePresence key={word}>
                  {currentWord >= index && (
                    <motion.span
                      className="text-7xl sm:text-8xl md:text-9xl font-black uppercase tracking-tight"
                      style={{ 
                        fontFamily: "var(--font-display)",
                        color: color,
                        textShadow: `6px 6px 0 ${accentColor}, -3px -3px 0 white, 3px -3px 0 white, -3px 3px 0 white, 8px 8px 20px rgba(0,0,0,0.3)`,
                        WebkitTextStroke: `3px ${accentColor}`,
                      }}
                      initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, y: 50, opacity: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { scale: [0, 1.3, 1], y: 0, opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        duration: prefersReducedMotion ? 0.15 : 0.25,
                        ease: "easeOut",
                      }}
                    >
                      {word}
                    </motion.span>
                  )}
                </AnimatePresence>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
