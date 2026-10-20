'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Animated number counter component with smooth ease-out interpolation
 */
export default function CountUp({ value = 0, duration = 1200, prefix = '', suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimestamp = useRef(null);
  const targetValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const initialValue = useRef(0);

  useEffect(() => {
    let animationFrame;
    const startVal = displayValue;
    const endVal = targetValue;
    const startTime = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(startVal + (endVal - startVal) * easeOutCubic(progress));

      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrame = requestAnimationFrame(step);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [targetValue, duration]);

  return (
    <span>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
