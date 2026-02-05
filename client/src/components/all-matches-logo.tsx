interface AllMatchesLogoProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "static" | "reactive";
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  withOutline?: boolean;
}

function getLuminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(c => {
    const sRGB = parseInt(c, 16) / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.4;
}

function hasGoodContrast(color1: string, color2: string): boolean {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const contrastRatio = (lighter + 0.05) / (darker + 0.05);
  return contrastRatio >= 2.5;
}

const MATCHES_PATHS = [
  "M307.76,55.99c-15.34,1.34-27.82,14.71-27.82,30.05v35.59c0,2.25-1.43,3.81-3.27,3.97s-3.27-1.15-3.27-3.4v-35.59c0-15.34-12.48-26.52-27.82-25.18-15.54,1.36-27.82,14.71-27.82,30.05v100.43c0,13.09,10.64,22.39,23.52,21.26,4.3-.38,9.2-1.62,12.89-4.6-4.3-4.12-7.36-11.63-7.36-19.2v-50.32c0-1.84,1.43-3.4,3.07-3.54,1.84-.16,3.27,1.15,3.27,2.99v48.27c0,18.61,13.09,24.22,23.52,23.3s23.52-8.81,23.52-27.42v-48.27c0-1.84,1.43-3.4,3.27-3.56,1.64-.14,3.07,1.16,3.07,3v50.32c0,7.57-3.07,15.61-7.36,20.48,3.68,2.34,8.59,2.73,12.89,2.35,12.89-1.13,23.52-12.28,23.52-25.37v-100.43c0-15.34-12.27-26.54-27.82-25.18Z",
  "M398.98,48.01c-28.64,2.51-50.32,26.9-50.32,55.54v76.7c0,13.29,10.02,22.64,23.11,21.5s23.73-12.3,23.73-25.6v-38.86c0-1.84,1.43-3.6,3.48-3.78s3.48,1.33,3.48,3.17v38.86c0,13.29,10.43,22.61,23.73,21.45s23.11-12.25,23.11-25.54v-76.7c0-28.64-21.68-49.24-50.31-46.73ZM402.46,117.25c0,1.84-1.43,3.6-3.48,3.78s-3.48-1.33-3.48-3.17v-35.38c0-1.84,1.43-3.4,3.48-3.58s3.48,1.13,3.48,2.97v35.38Z",
  "M536.21,36l-57.6,5.04c-12.88,1.13-23.77,12.23-24.01,25.14-.25,13.55,10.06,23.13,23.52,21.95l2.44-.21c1.7-.15,3.08,1.11,3.08,2.81v77.22c0,12.88,10.16,22.88,23.04,21.99,13.53-.93,24.01-12.16,24.01-25.62v-77.71c0-1.7,1.38-3.2,3.08-3.35l1.95-.17c12.88-1.13,23.77-12.24,24.01-25.14.25-13.55-10.06-23.13-23.52-21.95Z",
  "M616.18,29.01c-28.23,2.47-50.32,26.9-50.32,55.54v49.09c0,28.64,22.09,49.2,50.32,46.73s50.31-26.49,50.31-54.72v-8.39c0-4.91-1.64-9.47-4.5-13.11-5.11,4.95-11.66,7.97-18.82,8.6s-13.7-1.26-19.02-5.29c-2.66,4.12-4.5,8.98-4.5,13.89v24.54c0,1.84-1.43,3.4-3.48,3.58s-3.48-1.13-3.48-2.97V63.47c0-1.84,1.43-3.4,3.48-3.58s3.48,1.13,3.48,2.97v23.11c0,13.09,10.43,22.61,23.52,21.46s23.32-12.47,23.32-25.56v-6.14c0-28.64-22.09-49.2-50.31-46.73Z",
  "M756.69,16.72c-13.29,1.16-23.73,12.3-23.73,25.6v36.82c0,1.84-1.43,3.4-3.48,3.58s-3.48-1.13-3.48-2.97v-36.82c0-13.29-10.43-22.61-23.73-21.45s-23.52,12.28-23.52,25.58v104.31c0,13.29,10.43,22.61,23.52,21.46s23.73-12.3,23.73-25.6v-36.82c0-1.84,1.43-3.4,3.48-3.58s3.48,1.13,3.48,2.97v36.82c0,13.29,10.43,22.61,23.73,21.45s23.52-12.28,23.52-25.58V38.18c0-13.29-10.43-22.61-23.52-21.46Z",
  "M834.82,57.74l29.66-2.59c13.09-1.15,23.11-12.66,23.11-26.36s-10.02-22.64-23.11-21.5l-47.04,4.12c-12.89,1.13-23.32,12.27-23.32,25.36v104.72c0,13.09,10.43,22.4,23.32,21.28l47.04-4.12c13.09-1.15,23.11-12.25,23.11-25.54s-10.02-22.85-23.11-21.7l-29.66,2.59c-1.84.16-3.27-1.15-3.27-2.99,0-1.64,1.43-3.19,3.27-3.35l18-1.57c12.27-1.07,22.09-11.14,22.09-24.02s-9.82-20.62-22.09-19.54l-18,1.57c-1.84.16-3.27-1.15-3.27-2.78s1.43-3.4,3.27-3.56Z",
  "M971.85,78.27c-16.98,1.49-29.66-10.5-29.66-26.86v-13.09c0-1.84,1.43-3.4,3.07-3.54s3.07,1.16,3.07,3v13.09c0,13.91,10.64,23,23.52,21.87s23.73-12.3,23.73-26.21c0-28.43-22.09-48.79-50.11-46.34s-50.52,26.71-50.52,55.14c0,9.2,2.66,17.97,7.16,25.35,4.09-3.63,11.45-6.93,16.98-7.42,16.77-1.47,29.25,10.53,29.25,27.1v21.48c0,2.25-1.43,4.01-3.07,4.15s-3.07-1.37-3.07-3.62v-21.48c0-12.89-10.64-23.2-23.11-22.11-13.5,1.18-24.14,11.52-24.14,27.06,0,27.82,22.29,48.16,50.52,45.69s50.11-26.68,50.11-55.11c0-9.2-2.45-17.99-6.95-25.37-4.5,3.46-11.45,6.73-16.77,7.19Z"
];

const BRAND_COLORS = {
  hotPink: '#FF1493',
  lemon: '#FFDC00',
  lavender: '#B388FF',
  mint: '#00D9A5',
  sky: '#00BFFF',
  coral: '#FF6B6B',
  peach: '#FFAB91',
  violet: '#7C4DFF',
  lime: '#C6FF00',
  tangerine: '#FF9800',
  tomato: '#FF4136',
  ink: '#1A1A1A',
};

const LIGHT_BRAND_COLORS = [
  BRAND_COLORS.lemon,
  BRAND_COLORS.mint, 
  BRAND_COLORS.sky,
  BRAND_COLORS.coral,
  BRAND_COLORS.peach,
  BRAND_COLORS.lime,
  BRAND_COLORS.lavender,
];

export function AllMatchesLogo({ 
  className = "", 
  style = {},
  variant = "reactive",
  primaryColor,
  secondaryColor,
  accentColor,
  withOutline = false,
}: AllMatchesLogoProps) {
  const isStatic = variant === "static";
  
  const heartColor = isStatic ? BRAND_COLORS.hotPink : (primaryColor || BRAND_COLORS.hotPink);
  const rawAllTextColor = isStatic ? BRAND_COLORS.lemon : (secondaryColor || BRAND_COLORS.lemon);
  const rawAccentColor = isStatic ? BRAND_COLORS.lemon : (accentColor || BRAND_COLORS.lemon);
  
  let allTextColor: string;
  if (isStatic) {
    allTextColor = rawAllTextColor;
  } else {
    if (hasGoodContrast(heartColor, rawAllTextColor)) {
      allTextColor = rawAllTextColor;
    } else {
      allTextColor = isLightColor(heartColor) ? BRAND_COLORS.ink : "#ffffff";
    }
  }
  
  const matchesIsBlack = true;
  const matchesTextColor = BRAND_COLORS.ink;
  
  let matchesShadowColor: string;
  if (matchesIsBlack) {
    const normalizedAccent = rawAccentColor.toLowerCase();
    const isWhite = normalizedAccent === '#ffffff' || normalizedAccent === '#fff' || normalizedAccent === 'white';
    const isBlackish = normalizedAccent === '#1a1a1a' || normalizedAccent === '#000000' || normalizedAccent === '#000' || normalizedAccent === 'black';
    
    if (!isWhite && !isBlackish && isLightColor(rawAccentColor)) {
      matchesShadowColor = rawAccentColor;
    } else {
      matchesShadowColor = BRAND_COLORS.lemon;
    }
  } else {
    matchesShadowColor = BRAND_COLORS.ink;
  }
  
  const outlineFilter = withOutline 
    ? "drop-shadow(4px 0 0 white) drop-shadow(-4px 0 0 white) drop-shadow(0 4px 0 white) drop-shadow(0 -4px 0 white) drop-shadow(3px 3px 0 white) drop-shadow(-3px 3px 0 white) drop-shadow(3px -3px 0 white) drop-shadow(-3px -3px 0 white)"
    : undefined;

  const extrusionLayers = [];
  const totalDepth = 28;
  const stepSize = 0.4;
  const numSteps = Math.ceil(totalDepth / stepSize);
  
  for (let i = numSteps; i >= 0; i--) {
    const x = -i * stepSize * 1.1;
    const y = i * stepSize * 0.85;
    extrusionLayers.push(
      <g key={`extrusion-${i}`} transform={`translate(${x}, ${y})`}>
        {MATCHES_PATHS.map((d, idx) => (
          <path key={idx} fill={matchesShadowColor} d={d} />
        ))}
      </g>
    );
  }

  return (
    <svg 
      viewBox="0 0 1010 280" 
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ 
        ...style, 
        overflow: 'visible',
        filter: outlineFilter,
      }}
      aria-label="All Matches!"
    >
      <g>
        <path fill={heartColor} d="M208.14,35.57c-28.88-22.06-71.9-14.48-96.1,16.95-28.88-22.06-71.9-14.48-96.1,16.95-24.2,31.42-20.41,74.78,8.47,96.84l104.58,79.9,87.63-113.79c24.2-31.42,20.41-74.78-8.47-96.84Z"/>
        
        <g>
          <path fill={allTextColor} d="M68.7,115.67c-.87-9.98,8.87-16.13,22.11-18.47,14.24-2.51,22.22,3.48,23.13,13.91.72,8.18-2.83,16.66-1.98,26.42.39,4.48,1.69,7.67,3.64,9.37-2.42,3.27-6.43,5.23-10.22,5.9-5.01.88-8.52-.55-10.78-3.11-2.9,4.27-7.54,6.79-12.99,7.75-8.12,1.43-15.48-2.62-16.25-11.48-1.13-12.89,9.85-20.41,21.53-22.47,2.67-.47,5.48-.62,8.09-.52.05-.69-.02-1.48-.07-2.15-.23-2.58-1.99-4.66-6.44-3.87-4,.71-8.24,3.96-9.65,7.17-5.12.9-9.68-3.53-10.12-8.46ZM93.37,131.7c-1.71-.15-3.29-.1-4.62.13-4.67.82-6.79,3.7-6.59,6.06.13,1.46,1.54,2.12,3.32,1.81,3.67-.65,6.33-3.85,7.89-7.99Z"/>
          <path fill={allTextColor} d="M141.35,141.79c-1.85,3.4-7.05,5.91-12.06,6.79-9.34,1.65-13.9-3.92-14.58-11.66-1.11-12.67,6.74-33.97,5.25-51.01-.43-4.93-2.61-9.22-4.36-11.07,2.92-4.04,7.49-6.1,11.6-6.83,9.34-1.65,15.04,4.06,15.94,14.38,1.35,15.47-6.62,39.19-5.63,50.51.28,3.25,1.18,7.08,3.83,8.89Z"/>
          <path fill={allTextColor} d="M167.27,137.22c-1.85,3.4-7.05,5.91-12.06,6.79-9.34,1.65-13.9-3.92-14.58-11.66-1.11-12.67,6.74-33.97,5.25-51.01-.43-4.93-2.61-9.22-4.36-11.07,2.92-4.04,7.49-6.1,11.6-6.83,9.34-1.65,15.04,4.06,15.94,14.38,1.35,15.47-6.62,39.19-5.63,50.51.28,3.25,1.18,7.08,3.83,8.89Z"/>
        </g>

        {extrusionLayers}

        <g>
          {MATCHES_PATHS.map((d, idx) => (
            <path key={idx} fill={matchesTextColor} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}
