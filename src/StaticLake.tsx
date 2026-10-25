// The world as a still ink painting, for browsers without WebGL
// (docs/03 §11): the serene night palette (engine/palette.ts), distant
// mountains, a pale moon and its light broken on the lake. The moon sits
// near the middle so a tall phone screen, which shows only the centre, keeps it.

export function StaticLake() {
  return (
    <svg className="static-lake" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B111D" />
          <stop offset="1" stopColor="#22314A" />
        </linearGradient>
        <linearGradient id="sl-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2638" />
          <stop offset="1" stopColor="#0A111A" />
        </linearGradient>
        <radialGradient id="sl-halo">
          <stop offset="0" stopColor="#E9D9A6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#E9D9A6" stopOpacity="0" />
        </radialGradient>
        <filter id="sl-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="1600" height="540" fill="url(#sl-sky)" />
      <circle cx="880" cy="230" r="170" fill="url(#sl-halo)" />
      <circle cx="880" cy="230" r="52" fill="#E6DCC0" opacity="0.92" />
      <path
        d="M0 470 C120 430 220 400 330 420 S520 360 640 395 S820 440 930 410 S1120 350 1240 400 S1460 430 1600 405 V540 H0Z"
        fill="#1E2836"
        opacity="0.7"
        filter="url(#sl-soft)"
      />
      <path d="M0 505 C160 470 300 455 420 480 S700 450 820 478 S1080 460 1220 485 S1460 470 1600 490 V540 H0Z" fill="#1E2836" />
      <rect y="540" width="1600" height="460" fill="url(#sl-water)" />
      <path d="M0 540 H1600" stroke="#2c3b52" strokeWidth="2" opacity="0.6" />
      <g fill="#E9D9A6" filter="url(#sl-soft)">
        <rect x="850" y="570" width="60" height="4" rx="2" opacity="0.55" />
        <rect x="825" y="610" width="96" height="4" rx="2" opacity="0.4" />
        <rect x="865" y="650" width="44" height="4" rx="2" opacity="0.45" />
        <rect x="805" y="700" width="120" height="5" rx="2.5" opacity="0.28" />
        <rect x="850" y="760" width="70" height="5" rx="2.5" opacity="0.22" />
        <rect x="780" y="830" width="150" height="6" rx="3" opacity="0.14" />
      </g>
    </svg>
  );
}
