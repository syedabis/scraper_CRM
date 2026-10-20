import confetti from 'canvas-confetti';

/**
 * Fires a multi-directional celebration confetti burst when a deal is closed / won.
 */
export function fireDealWonConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Realistic confetti burst with emerald, gold, cyan, and white
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#38bdf8'],
  });
  fire(0.2, {
    spread: 60,
    colors: ['#059669', '#10b981', '#fbbf24', '#ffffff'],
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#10b981', '#6ee7b7', '#a7f3d0', '#60a5fa'],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#f59e0b', '#fbbf24', '#34d399'],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ['#10b981', '#38bdf8', '#c084fc'],
  });
}

/**
 * Subtle starburst effect when a meeting is booked.
 */
export function fireMeetingBookedEffect() {
  confetti({
    particleCount: 50,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#06b6d4', '#38bdf8', '#a855f7', '#f59e0b'],
    zIndex: 9999,
    ticks: 120,
    gravity: 1.2,
    scalar: 0.9,
  });
}
