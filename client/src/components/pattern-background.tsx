import { useMemo } from "react";
import { PATTERN_NAMES, getPatternStyle } from "@/styles/patterns";

const SESSION_PATTERN_KEY = "eg-session-pattern-index";

function getSessionPatternIndex(): number {
  if (typeof window === "undefined") return 0;
  
  const stored = sessionStorage.getItem(SESSION_PATTERN_KEY);
  if (stored !== null) {
    const idx = parseInt(stored, 10);
    if (!isNaN(idx) && idx >= 0 && idx < PATTERN_NAMES.length) {
      return idx;
    }
  }
  
  const newIndex = Math.floor(Math.random() * PATTERN_NAMES.length);
  sessionStorage.setItem(SESSION_PATTERN_KEY, String(newIndex));
  return newIndex;
}

interface PatternBackgroundProps {
  children: React.ReactNode;
  className?: string;
  opacity?: number;
  baseColor?: string;
}

export function PatternBackground({ 
  children, 
  className = "", 
  opacity = 0.12,
  baseColor = "#FFF8E7",
}: PatternBackgroundProps) {
  const patternIndex = useMemo(() => getSessionPatternIndex(), []);
  const patternName = PATTERN_NAMES[patternIndex];
  const patternStyle = useMemo(() => getPatternStyle(patternName), [patternName]);

  return (
    <div 
      className={`relative min-h-screen ${className}`}
      style={{ background: baseColor }}
    >
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          ...patternStyle,
          opacity,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
