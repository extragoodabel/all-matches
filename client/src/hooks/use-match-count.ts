import { useState, useEffect, useRef } from "react";

const LAST_SEEN_KEY = "matchCountLastSeen";
const listeners = new Set<(count: number) => void>();
let globalMatchCount = 0;

function notifyAll(count: number) {
  listeners.forEach((fn) => fn(count));
}

function getLastSeenCount(): number {
  try {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    return stored ? parseInt(stored, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveLastSeenCount(count: number) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(count));
  } catch {}
}

export function incrementMatchCount() {
  globalMatchCount += 1;
  notifyAll(globalMatchCount);
}

export function setMatchCount(count: number) {
  globalMatchCount = count;
  notifyAll(globalMatchCount);
}

export function getMatchCount() {
  return globalMatchCount;
}

export function useMatchCount() {
  const [count, setCount] = useState(globalMatchCount);

  useEffect(() => {
    const listener = (newCount: number) => setCount(newCount);
    listeners.add(listener);
    setCount(globalMatchCount);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return count;
}

export function useMatchCountAnimator() {
  const count = useMatchCount();
  const lastSeenOnMount = useRef(getLastSeenCount());
  const [displayCount, setDisplayCount] = useState(count);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayCount(count);
      if (count > lastSeenOnMount.current) {
        setShouldAnimate(true);
        saveLastSeenCount(count);
        const timer = setTimeout(() => setShouldAnimate(false), 2000);
        return () => clearTimeout(timer);
      }
      saveLastSeenCount(count);
      return;
    }

    if (count > displayCount) {
      setShouldAnimate(true);
      setDisplayCount(count);
      saveLastSeenCount(count);
      const timer = setTimeout(() => setShouldAnimate(false), 2000);
      return () => clearTimeout(timer);
    }

    setDisplayCount(count);
    saveLastSeenCount(count);
  }, [count]);

  return { displayCount, shouldAnimate };
}
