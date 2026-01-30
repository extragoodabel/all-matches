import { useMemo } from "react";
import { PATTERN_NAMES, getPatternStyle, type PatternName } from "@/styles/patterns";

export function getRandomPatternIndex(): number {
  return Math.floor(Math.random() * PATTERN_NAMES.length);
}

export function getPatternNameByIndex(index: number): PatternName {
  return PATTERN_NAMES[index % PATTERN_NAMES.length];
}

interface PatternBackgroundProps {
  children: React.ReactNode;
  className?: string;
  opacity?: number;
  baseColor?: string;
  patternIndex?: number;
}

export function PatternBackground({ 
  children, 
  className = "", 
  opacity = 0.12,
  baseColor = "#FFF8E7",
  patternIndex,
}: PatternBackgroundProps) {
  const finalPatternIndex = useMemo(() => {
    return patternIndex !== undefined ? patternIndex : getRandomPatternIndex();
  }, [patternIndex]);
  
  const patternName = getPatternNameByIndex(finalPatternIndex);
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
