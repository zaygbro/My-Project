import type { CSSProperties } from "react";

/**
 * Slow-drifting blue balls behind the dashboard shell — the animated
 * counterpart to .dashboard-glow's static blobs in globals.css. Pure CSS
 * (transform + opacity only, so it stays on the compositor), each orb on
 * its own duration/delay so the drift reads as ambient rather than a
 * single visible loop repeating in lockstep.
 */
const ORBS = [
  { top: "4%", left: "8%", size: 300, alpha: 0.55, duration: 26, delay: "-2s" },
  { top: "58%", left: "80%", size: 380, alpha: 0.5, duration: 32, delay: "-14s" },
  { top: "76%", left: "14%", size: 240, alpha: 0.5, duration: 22, delay: "-8s" },
  { top: "14%", left: "62%", size: 210, alpha: 0.45, duration: 28, delay: "-20s" },
  { top: "40%", left: "38%", size: 170, alpha: 0.35, duration: 24, delay: "-5s" },
];

export function AmbientOrbs() {
  return (
    <div className="ambient-orbs" aria-hidden="true">
      {ORBS.map((orb, i) => (
        <span
          key={i}
          className="ambient-orb"
          style={
            {
              top: orb.top,
              left: orb.left,
              width: orb.size,
              height: orb.size,
              animationDuration: `${orb.duration}s`,
              animationDelay: orb.delay,
              "--orb-color": `rgba(59, 130, 246, ${orb.alpha})`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
