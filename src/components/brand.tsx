/**
 * Axiom TV — Logotype hexagonal broadcast.
 */
export function Logomark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="axiom-grad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5FF" />
          <stop offset="1" stopColor="#9D4EDD" />
        </linearGradient>
      </defs>
      <path d="M20 2.5 35.5 11.4v17.2L20 37.5 4.5 28.6V11.4L20 2.5Z" fill="rgba(0,229,255,0.07)" stroke="url(#axiom-grad)" strokeWidth="1.8" />
      <path d="M16.2 13.4v13.2L27 20l-10.8-6.6Z" fill="url(#axiom-grad)" />
      <circle cx="31.4" cy="8.8" r="1.7" fill="#00E5FF" />
      <circle cx="8.8" cy="31" r="1.3" fill="#9D4EDD" />
    </svg>
  );
}

export function Avatar({ url, name, size = 36, hue = "#00e5ff", hueTo = "#9d4edd" }: { url?: string | null; name: string; size?: number; hue?: string; hueTo?: string }) {
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return url ? (
    <img src={url} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="font-display grid place-items-center rounded-full font-bold text-white ring-1 ring-white/20"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, ${hue}55, ${hueTo}66)`,
        textShadow: `0 0 12px ${hue}`,
      }}
    >
      {initials}
    </span>
  );
}
