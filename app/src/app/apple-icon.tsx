import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <svg width="180" height="180" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="bg" cx="30%" cy="20%" r="85%">
              <stop offset="0%" stopColor="#16181d" />
              <stop offset="60%" stopColor="#0a0a0d" />
            </radialGradient>
            <linearGradient id="front" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#5fd4ff" />
            </linearGradient>
            <linearGradient id="back" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#16264d" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="22" fill="url(#bg)" />
          <g transform="translate(7,7)">
            <rect x="32" y="20" width="15" height="60" fill="url(#back)" />
            <rect x="32" y="20" width="38" height="15" fill="url(#back)" />
            <rect x="32" y="46" width="29" height="14" fill="url(#back)" />
          </g>
          <rect x="32" y="20" width="15" height="60" fill="url(#front)" />
          <rect x="32" y="20" width="38" height="15" fill="url(#front)" />
          <rect x="32" y="46" width="29" height="14" fill="url(#front)" />
          <polygon points="32,20 47,20 32,45" fill="#ffffff" opacity="0.3" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
