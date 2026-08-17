/**
 * Lightweight notification chime using the Web Audio API — no audio file needed,
 * works offline, and is generated on the fly. Plays a soft two-note "ding-dong".
 *
 * Browsers block audio until the user has interacted with the page, so call
 * primeNotificationSound() once on mount; it resumes the AudioContext on the
 * first click/keypress so later chimes (fired by polling) are allowed to play.
 *
 * Ported from frontend/src/lib/notificationSound.js. Every guard survives the
 * port intact, including the `typeof window` checks — this module is imported by
 * a Client Component, but Next still evaluates that module on the server during
 * the initial render, so touching `window` at module scope would crash the page.
 */

/** Safari shipped the prefixed constructor long before the standard one. */
type AudioContextConstructor = new () => AudioContext;

let audioContext: AudioContext | null = null;
let primed = false;

const ensureContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const globalWithWebkit = window as Window &
    typeof globalThis & { webkitAudioContext?: AudioContextConstructor };
  const AudioCtx: AudioContextConstructor | undefined =
    globalWithWebkit.AudioContext || globalWithWebkit.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) {
    try {
      audioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return audioContext;
};

/** Attach a one-time gesture listener that unlocks audio playback. */
export const primeNotificationSound = (): void => {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const unlock = () => {
    const ctx = ensureContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
};

/** Play the chime. Safe to call anytime — silently no-ops if audio is unavailable. */
export const playNotificationChime = (): void => {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Two gentle sine notes (A5 -> D6) with a soft attack/decay envelope.
    const notes = [
      { freq: 880.0, start: 0 },
      { freq: 1174.66, start: 0.13 },
    ];

    notes.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.45);
    });
  } catch {
    // Never let a sound failure affect the app.
  }
};
