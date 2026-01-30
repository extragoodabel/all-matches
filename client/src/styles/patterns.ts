export const PATTERNS = {
  checker: `
    repeating-conic-gradient(
      var(--eg-primary, #FF1493) 0% 25%,
      var(--eg-secondary, #FFDC00) 0% 50%
    ) 50% / 40px 40px
  `,
  
  stripes: `
    repeating-linear-gradient(
      -45deg,
      var(--eg-primary, #FF1493),
      var(--eg-primary, #FF1493) 10px,
      var(--eg-secondary, #FFDC00) 10px,
      var(--eg-secondary, #FFDC00) 20px
    )
  `,
  
  dots: `
    radial-gradient(
      circle,
      var(--eg-primary, #FF1493) 8px,
      transparent 8px
    ) 0 0 / 32px 32px,
    var(--eg-secondary, #FFDC00)
  `,
  
  squiggle: `url("data:image/svg+xml,%3Csvg width='52' height='26' viewBox='0 0 52 26' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z' fill='%23FF1493' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E"), var(--eg-secondary, #FFDC00)`,
  
  halftone: `
    radial-gradient(
      circle,
      var(--eg-primary, #FF1493) 2px,
      transparent 2px
    ) 0 0 / 12px 12px,
    radial-gradient(
      circle,
      var(--eg-primary, #FF1493) 2px,
      transparent 2px
    ) 6px 6px / 12px 12px,
    var(--eg-secondary, #FFDC00)
  `,
  
  stars: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 5l2.5 7.5H30l-6 4.5 2.5 7.5-6.5-5-6.5 5 2.5-7.5-6-4.5h7.5z' fill='%23FF1493' fill-opacity='0.6'/%3E%3C/svg%3E"), var(--eg-secondary, #FFDC00)`,
  
  hearts: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 30l-1.5-1.4C12 22.7 8 19.2 8 15c0-3.3 2.7-6 6-6 1.9 0 3.7.9 4.8 2.3L20 12.5l1.2-1.2C22.3 9.9 24.1 9 26 9c3.3 0 6 2.7 6 6 0 4.2-4 7.7-10.5 13.6L20 30z' fill='%23FF1493' fill-opacity='0.5'/%3E%3C/svg%3E"), var(--eg-secondary, #FFDC00)`,
  
  zigzag: `
    linear-gradient(135deg, var(--eg-primary, #FF1493) 25%, transparent 25%),
    linear-gradient(225deg, var(--eg-primary, #FF1493) 25%, transparent 25%),
    linear-gradient(45deg, var(--eg-primary, #FF1493) 25%, transparent 25%),
    linear-gradient(315deg, var(--eg-primary, #FF1493) 25%, var(--eg-secondary, #FFDC00) 25%)
  `,
  
  waves: `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10c5.5 0 5.5-5 11-5s5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5v10H0z' fill='%23FF1493' fill-opacity='0.4'/%3E%3C/svg%3E"), var(--eg-secondary, #FFDC00)`,
  
  grid: `
    linear-gradient(var(--eg-primary, #FF1493) 2px, transparent 2px),
    linear-gradient(90deg, var(--eg-primary, #FF1493) 2px, var(--eg-secondary, #FFDC00) 2px)
  `,
  
  confetti: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='5' y='5' width='8' height='8' fill='%23FF1493' transform='rotate(15 9 9)'/%3E%3Crect x='35' y='25' width='6' height='6' fill='%23FFDC00' transform='rotate(-20 38 28)'/%3E%3Crect x='15' y='40' width='7' height='7' fill='%2300D9A5' transform='rotate(45 18.5 43.5)'/%3E%3Ccircle cx='45' cy='10' r='4' fill='%23B388FF'/%3E%3C/svg%3E"), var(--eg-background, #FFF8E7)`,
  
  diamonds: `
    linear-gradient(45deg, var(--eg-primary, #FF1493) 25%, transparent 25%),
    linear-gradient(-45deg, var(--eg-primary, #FF1493) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--eg-primary, #FF1493) 75%),
    linear-gradient(-45deg, transparent 75%, var(--eg-primary, #FF1493) 75%)
  `,
} as const;

export type PatternName = keyof typeof PATTERNS;

export function getPatternCSS(name: PatternName): string {
  return PATTERNS[name];
}

export function getPatternStyle(name: PatternName): React.CSSProperties {
  const pattern = PATTERNS[name];
  
  if (name === 'zigzag') {
    return {
      background: pattern,
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 10px 0, 10px -10px, 0px 10px',
    };
  }
  
  if (name === 'grid') {
    return {
      background: pattern,
      backgroundSize: '24px 24px',
    };
  }
  
  if (name === 'diamonds') {
    return {
      background: pattern,
      backgroundSize: '30px 30px',
      backgroundPosition: '0 0, 15px 15px, 15px 15px, 0 0',
    };
  }
  
  return { background: pattern };
}

export const PATTERN_NAMES: PatternName[] = Object.keys(PATTERNS) as PatternName[];
