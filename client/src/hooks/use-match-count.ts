import { useState, useEffect, useRef } from "react";

const listeners = new Set<(count: number) => void>();
let globalMatchCount = 0;
let lastDisplayedOnMessages = 0;

function notifyAll(count: number) {
  listeners.forEach((fn) => fn(count));
}

export function incrementMatchCount() {
  globalMatchCount += 1;
  notifyAll(globalMatchCount);
}

export function setMatchCount(count: number) {
  if (count !== globalMatchCount) {
    globalMatchCount = count;
    notifyAll(globalMatchCount);
  }
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
  const [displayCount, setDisplayCount] = useState(count);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayCount(count);
      if (count > lastDisplayedOnMessages) {
        setShouldAnimate(true);
        lastDisplayedOnMessages = count;
        const timer = setTimeout(() => setShouldAnimate(false), 2000);
        return () => clearTimeout(timer);
      }
      lastDisplayedOnMessages = count;
      return;
    }

    if (count > lastDisplayedOnMessages) {
      setShouldAnimate(true);
      setDisplayCount(count);
      lastDisplayedOnMessages = count;
      const timer = setTimeout(() => setShouldAnimate(false), 2000);
      return () => clearTimeout(timer);
    }

    setDisplayCount(count);
    lastDisplayedOnMessages = count;
  }, [count]);

  return { displayCount, shouldAnimate };
}
