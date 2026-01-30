import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

// Easter Egg #1: "MEANS NOTHING" glitch overlay (1% chance on match)
export function MeansNothingGlitch({ 
  isActive, 
  onComplete 
}: { 
  isActive: boolean; 
  onComplete: () => void;
}) {
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(onComplete, 250);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.05 }}
        >
          <div 
            className="absolute inset-0"
            style={{
              background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px)',
              animation: 'scanlines 0.1s linear infinite',
            }}
          />
          <motion.div
            className="relative"
            animate={{ 
              x: [0, -5, 5, -3, 3, 0],
              filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(-90deg)', 'hue-rotate(0deg)'],
            }}
            transition={{ duration: 0.2, ease: "linear" }}
          >
            <h1 
              className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white"
              style={{
                textShadow: '-3px 0 #ff0000, 3px 0 #00ffff, 0 0 20px rgba(255,255,255,0.8)',
                fontFamily: 'var(--font-display)',
              }}
            >
              THIS MEANS NOTHING
            </h1>
          </motion.div>
          <style>{`
            @keyframes scanlines {
              0% { transform: translateY(0); }
              100% { transform: translateY(3px); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Easter Egg #2: Long-press logo heartbeat
export function useLogoLongPress(onActivate: () => void) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const startPress = useCallback(() => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      onActivate();
      setIsPressed(false);
    }, 700);
  }, [onActivate]);

  const endPress = useCallback(() => {
    setIsPressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { startPress, endPress, isPressed };
}

export function ValidationAcquired({ 
  isActive, 
  onComplete 
}: { 
  isActive: boolean; 
  onComplete: () => void;
}) {
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ background: 'rgba(255, 105, 180, 0.12)' }}
          />
          <motion.p
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[61] text-sm font-medium tracking-widest uppercase pointer-events-none"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{ 
              color: '#FF69B4',
              fontFamily: 'var(--font-display)',
            }}
          >
            validation acquired
          </motion.p>
        </>
      )}
    </AnimatePresence>
  );
}

// Easter Egg #3: Rapid-tap heart overheat
export function useHeartOverheat() {
  const [tapCount, setTapCount] = useState(0);
  const [isOverheated, setIsOverheated] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordTap = useCallback(() => {
    if (isOverheated) return;
    
    setTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 6) {
        setIsOverheated(true);
        setTimeout(() => {
          setIsOverheated(false);
          setTapCount(0);
        }, 1500);
        return 0;
      }
      return newCount;
    });

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, 800);
  }, [isOverheated]);

  return { recordTap, isOverheated, tapCount };
}

export function HeartOverheatEffect({ isActive }: { isActive: boolean }) {
  return (
    <AnimatePresence>
      {isActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, repeat: 4 }}
            style={{ 
              boxShadow: '0 0 20px 10px rgba(255, 50, 50, 0.6), inset 0 0 10px rgba(255,100,50,0.3)',
            }}
          />
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full pointer-events-none"
              style={{ 
                background: 'rgba(100,100,100,0.6)',
                left: `${30 + i * 10}%`,
                bottom: '100%',
              }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ 
                opacity: [0, 0.8, 0],
                y: -30 - i * 10,
                scale: [0.5, 1.5, 0.5],
              }}
              transition={{ 
                duration: 1,
                delay: i * 0.15,
                ease: "easeOut",
              }}
            />
          ))}
          <motion.p
            className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold uppercase pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ 
              color: '#FF4136',
              fontFamily: 'var(--font-display)',
            }}
          >
            please pace yourself
          </motion.p>
        </>
      )}
    </AnimatePresence>
  );
}

// Easter Egg #4: 10 left swipes "tough crowd"
export function useToughCrowd() {
  const [leftSwipeCount, setLeftSwipeCount] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const recordSwipe = useCallback((direction: 'left' | 'right') => {
    if (direction === 'left') {
      setLeftSwipeCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 10) {
          setIsActive(true);
          setTimeout(() => setIsActive(false), 800);
          return 0;
        }
        return newCount;
      });
    } else {
      setLeftSwipeCount(0);
    }
  }, []);

  return { recordSwipe, isActive, leftSwipeCount };
}

export function ToughCrowdEffect({ isActive }: { isActive: boolean }) {
  return (
    <AnimatePresence>
      {isActive && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 0.8, times: [0, 0.5, 1] }}
            style={{
              backdropFilter: 'grayscale(100%)',
              WebkitBackdropFilter: 'grayscale(100%)',
            }}
          />
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div 
              className="px-6 py-3 bg-white rounded-full border-2 border-black shadow-lg"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="text-lg font-bold">tough crowd</span>
            </div>
          </motion.div>
          <motion.div
            className="fixed top-20 right-8 z-[101] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative">
              <Heart className="w-10 h-10 text-gray-400" />
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 rounded-full"
                  style={{ 
                    background: 'linear-gradient(to bottom, #DC143C, #8B0000)',
                    height: '12px',
                    left: `${35 + i * 12}%`,
                    top: '80%',
                  }}
                  initial={{ opacity: 0, y: 0, scaleY: 0 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0],
                    y: [0, 15, 25, 35],
                    scaleY: [0, 1, 0.8, 0.3],
                  }}
                  transition={{ 
                    duration: 0.7,
                    delay: i * 0.1,
                    ease: "easeIn",
                  }}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Easter Egg #5: Header click spam
export function useHeaderClickSpam() {
  const [clickCount, setClickCount] = useState(0);
  const [showAlternate, setShowAlternate] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordClick = useCallback(() => {
    if (showAlternate) return;
    
    setClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 8) {
        setShowAlternate(true);
        setTimeout(() => {
          setShowAlternate(false);
          setClickCount(0);
        }, 2500);
        return 0;
      }
      return newCount;
    });

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1000);
  }, [showAlternate]);

  return { recordClick, showAlternate };
}
