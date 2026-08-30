'use client';

// "use client" is required: this is a pointer-driven effect built entirely on
// browser APIs — window listeners, matchMedia, requestAnimationFrame, timers and
// per-particle state. There is nothing here a server render could produce.

import { useEffect, useRef, useState } from "react";

const COLORS = ["bg-amber-400", "bg-amber-500", "bg-lime-400", "bg-green-400"] as const;
const MIN_SIZE = 3;
const MAX_SIZE = 5;
const LIFETIME_MS = 1000;
const MAX_PARTICLES = 160;
const SPAWN_INTERVAL_MS = 16;

interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  colorClass: string;
}

const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min);

const getRandomSize = (): number =>
  Math.floor(Math.random() * (MAX_SIZE - MIN_SIZE + 1)) + MIN_SIZE;

const getRandomColor = (): string =>
  COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0];

const getParticleId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const PollenParticle = ({ particle }: { particle: Particle }) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsFading(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const baseTransform = "translate(-50%, -50%)";
  const driftTransform = `${baseTransform} translate(${particle.dx}px, ${particle.dy}px)`;

  return (
    <span
      className="absolute"
      style={{
        left: particle.x,
        top: particle.y,
      }}
    >
      <span
        className={`block rounded-full transition-[opacity,transform] duration-1000 ease-out ${
          particle.colorClass
        } ${isFading ? "opacity-0" : "opacity-100"}`}
        style={{
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          transform: isFading ? driftTransform : baseTransform,
        }}
      />
    </span>
  );
};

export function CursorPollenTrail() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const cleanupTimersRef = useRef<Map<string, number>>(new Map());
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (isTouch) {
      setIsEnabled(false);
      return undefined;
    }

    setIsEnabled(true);

    const spawnParticle = (x: number, y: number) => {
      const id = getParticleId();
      const particle: Particle = {
        id,
        x,
        y,
        size: getRandomSize(),
        dx: randomInRange(-14, 14),
        dy: randomInRange(-16, 10),
        colorClass: getRandomColor(),
      };

      setParticles((prev) => [...prev, particle].slice(-MAX_PARTICLES));

      const timeoutId = window.setTimeout(() => {
        setParticles((prev) => prev.filter((item) => item.id !== id));
        cleanupTimersRef.current.delete(id);
      }, LIFETIME_MS);

      cleanupTimersRef.current.set(id, timeoutId);
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      const now = performance.now();
      if (now - lastSpawnRef.current < SPAWN_INTERVAL_MS) {
        return;
      }

      lastSpawnRef.current = now;
      spawnParticle(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleMove);
    };
  }, []);

  useEffect(() => () => {
    const timers = cleanupTimersRef.current;
    timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timers.clear();
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30 hidden md:block">
      {particles.map((particle) => (
        <PollenParticle key={particle.id} particle={particle} />
      ))}
    </div>
  );
}
