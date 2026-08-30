import { useId } from "react";

/**
 * The layered-F mark: two offset copies of the same letterform (a dim back
 * layer, a bright front layer) plus a diagonal highlight on the stem. Picked
 * over a flatter single-layer F because it reads with real depth at sidebar
 * size while still resolving cleanly at 16px favicon scale.
 *
 * Gradient ids are namespaced with useId() so multiple instances (sidebar +
 * a header on the same page) never collide on one <defs>.
 */
export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  const uid = useId();
  const front = `${uid}-front`;
  const back = `${uid}-back`;
  const glow = `${uid}-glow`;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(120% 120% at 30% 20%, #16181d 0%, #0a0a0d 60%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id={front} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#5fd4ff" />
          </linearGradient>
          <linearGradient id={back} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16264d" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <radialGradient id={glow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="44" fill={`url(#${glow})`} />
        <g transform="translate(7,7)">
          <rect x="32" y="20" width="15" height="60" fill={`url(#${back})`} />
          <rect x="32" y="20" width="38" height="15" fill={`url(#${back})`} />
          <rect x="32" y="46" width="29" height="14" fill={`url(#${back})`} />
        </g>
        <rect x="32" y="20" width="15" height="60" fill={`url(#${front})`} />
        <rect x="32" y="20" width="38" height="15" fill={`url(#${front})`} />
        <rect x="32" y="46" width="29" height="14" fill={`url(#${front})`} />
        <polygon points="32,20 47,20 32,45" fill="#ffffff" opacity="0.3" />
      </svg>
    </span>
  );
}
