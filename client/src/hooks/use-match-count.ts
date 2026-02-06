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
  const [displayCount, setDisplayCount] = useState(() =>
    count > lastDisplayedOnMessages ? lastDisplayedOnMessages : count
  );
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const mountedRef = useRef(false);
  const aliveRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!mountedRef.current) {
      mountedRef.current = true;

      if (count > lastDisplayedOnMessages) {
        setDisplayCount(lastDisplayedOnMessages);
        const startTimer = setTimeout(() => {
          if (!aliveRef.current) return;
          setShouldAnimate(true);
          setDisplayCount(count);
          lastDisplayedOnMessages = count;
          const endTimer = setTimeout(() => {
            if (!aliveRef.current) return;
            setShouldAnimate(false);
          }, 2000);
          timersRef.current.push(endTimer);
        }, 400);
        timersRef.current.push(startTimer);
        return;
      }

      setDisplayCount(count);
      lastDisplayedOnMessages = count;
      return;
    }

    if (count > lastDisplayedOnMessages) {
      setShouldAnimate(true);
      setDisplayCount(count);
      lastDisplayedOnMessages = count;
      const timer = setTimeout(() => {
        if (!aliveRef.current) return;
        setShouldAnimate(false);
      }, 2000);
      timersRef.current.push(timer);
      return;
    }

    setDisplayCount(count);
    lastDisplayedOnMessages = count;
  }, [count]);

  return { displayCount, shouldAnimate };
}
