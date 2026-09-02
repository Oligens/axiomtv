import { useId } from "react";

interface AgweLogoProps {
  size?: number;
  className?: string;
  decorative?: boolean;
}

/** AgwèStream — A aquatique néon animé, inspiré du SVG fourni. */
export default function AgweLogo({ size = 44, className = "", decorative = true }: AgweLogoProps) {
  const id = useId().replace(/:/g, "");
  const gradientId = `agweNeon-${id}`;
  const glowId = `agweGlow-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Logo AgwèStream"}
      aria-hidden={decorative ? true : undefined}
      className={`shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F2FE" />
          <stop offset="50%" stopColor="#0072FF" />
          <stop offset="100%" stopColor="#03001e" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="250" cy="250" r="220" fill="#0B0F19" stroke="rgba(0,242,254,0.2)" strokeWidth="2" />

      <path
        d="M 250 100 L 380 380 L 310 380 L 285 315 L 215 315 L 190 380 L 120 380 Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1000"
        strokeDasharray="1000"
        strokeDashoffset="1000"
        filter={`url(#${glowId})`}
        style={{ animation: "agweLogoTrace 4s ease-in-out infinite alternate" }}
      />

      <rect
        x="205"
        y="270"
        width="90"
        height="14"
        rx="7"
        fill={`url(#${gradientId})`}
        filter={`url(#${glowId})`}
        style={{ transformOrigin: "250px 277px", animation: "agweLogoBar 2s ease-in-out forwards" }}
      />

      <circle cx="250" cy="210" r="16" fill="#00F2FE" filter={`url(#${glowId})`}>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="r" values="13;18;13" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
