import { useEffect, useRef, useState } from "react";
import { getSessionPalette, getAccessibilityTextColor } from "@/styles/theme";
import { usePreferences } from "@/hooks/use-preferences";

interface OdometerCounterProps {
  value: number;
  animate: boolean;
}

function OdometerDigit({ digit, animate, delay, palette }: { digit: number; animate: boolean; delay: number; palette: ReturnType<typeof getSessionPalette> }) {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevDigitRef = useRef(digit);

  useEffect(() => {
    if (digit !== prevDigitRef.current) {
      if (animate) {
        const timer = setTimeout(() => {
          setIsAnimating(true);
          setCurrentDigit(digit);
          const endTimer = setTimeout(() => setIsAnimating(false), 600);
          prevDigitRef.current = digit;
          return () => clearTimeout(endTimer);
        }, delay);
        return () => clearTimeout(timer);
      } else {
        setCurrentDigit(digit);
        prevDigitRef.current = digit;
      }
    }
  }, [digit, animate, delay]);

  const digitColor = getAccessibilityTextColor(palette.accent);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "1.4em",
        height: "2em",
        background: palette.accent,
        borderRadius: 6,
        border: `2px solid ${palette.text}`,
        boxShadow: `inset 0 2px 6px ${palette.text}44, inset 0 -2px 4px ${palette.text}22, 2px 2px 0 ${palette.text}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${-currentDigit * 100}%)`,
          transition: isAnimating ? "transform 0.6s cubic-bezier(0.22, 0.68, 0.35, 1.2)" : "none",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div
            key={n}
            style={{
              height: "2em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: "1.3em",
              color: digitColor,
              flexShrink: 0,
            }}
          >
            {n}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: "49%",
          left: 0,
          right: 0,
          height: 2,
          background: `${palette.text}33`,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "30%",
          background: `linear-gradient(to bottom, ${palette.text}22, transparent)`,
          pointerEvents: "none",
          zIndex: 2,
          borderRadius: "6px 6px 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "30%",
          background: `linear-gradient(to top, ${palette.text}18, transparent)`,
          pointerEvents: "none",
          zIndex: 2,
          borderRadius: "0 0 6px 6px",
        }}
      />
    </div>
  );
}

export function OdometerCounter({ value, animate }: OdometerCounterProps) {
  const palette = getSessionPalette();
  const { preferences } = usePreferences();

  const digits = String(Math.max(0, value)).padStart(3, "0").split("").map(Number);

  const labelColor = preferences.accessibilityMode
    ? getAccessibilityTextColor(palette.background)
    : palette.text;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        paddingBottom: 16,
        paddingTop: 12,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 14px",
            background: palette.primary,
            borderRadius: 14,
            border: `3px solid ${palette.text}`,
            boxShadow: `4px 4px 0 ${palette.text}`,
            fontSize: 20,
          }}
        >
          {digits.map((d, i) => (
            <OdometerDigit
              key={i}
              digit={d}
              animate={animate}
              delay={i * 120}
              palette={palette}
            />
          ))}
        </div>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: labelColor,
          }}
        >
          Total Matches
        </span>
      </div>
    </div>
  );
}
