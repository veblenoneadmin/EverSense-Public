export function EverSenseLogo({ width = 460, height = 110 }: { width?: number; height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 475 110" width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="wgrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#007acc' }} />
          <stop offset="100%" style={{ stopColor: '#29b6f6' }} />
        </linearGradient>
        <linearGradient id="aigl" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#29b6f6' }} />
          <stop offset="100%" style={{ stopColor: '#00e5ff' }} />
        </linearGradient>
        <linearGradient id="circlegrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#007acc' }} />
          <stop offset="100%" style={{ stopColor: '#005a9e' }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ICON — solid blue circle, white checkmark */}
      <circle cx="52" cy="52" r="46" fill="url(#circlegrad)" />
      {/* Subtle inner ring */}
      <circle cx="52" cy="52" r="40" fill="none" stroke="white" strokeWidth="0.8" opacity="0.15" />
      {/* White checkmark — high contrast on blue */}
      <path d="M26 52 L43 69 L78 32" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* FIREFLIES */}
      <circle cx="52"  cy="3"   r="3.5" fill="#29b6f6" filter="url(#glow2)" />
      <circle cx="98"  cy="20"  r="3"   fill="#29b6f6" filter="url(#glow2)" />
      <circle cx="106" cy="66"  r="2.5" fill="#00e5ff" filter="url(#glow)" />
      <circle cx="12"  cy="26"  r="2.5" fill="#29b6f6" filter="url(#glow)" />
      <circle cx="3"   cy="68"  r="3"   fill="#29b6f6" filter="url(#glow2)" />
      <circle cx="36"  cy="102" r="2"   fill="#29b6f6" filter="url(#glow)" />
      <circle cx="74"  cy="106" r="2.5" fill="#00e5ff" filter="url(#glow)" />
      <circle cx="90"  cy="5"   r="1.8" fill="#00e5ff" opacity="0.7" filter="url(#glow)" />
      <circle cx="16"  cy="82"  r="1.8" fill="#29b6f6" opacity="0.8" filter="url(#glow)" />
      <circle cx="102" cy="44"  r="1.5" fill="#29b6f6" opacity="0.7" filter="url(#glow)" />
      <circle cx="6"   cy="50"  r="1.5" fill="#00e5ff" opacity="0.5" />
      <circle cx="78"  cy="2"   r="1.2" fill="#007acc" opacity="0.5" />
      <circle cx="20"  cy="10"  r="1"   fill="#29b6f6" opacity="0.4" />
      <circle cx="98"  cy="88"  r="1.2" fill="#29b6f6" opacity="0.45" />
      <circle cx="8"   cy="94"  r="1"   fill="#00e5ff" opacity="0.35" />
      <circle cx="48"  cy="107" r="1"   fill="#29b6f6" opacity="0.4" />

      {/* WORDMARK */}
      <text x="130" y="56" fontFamily="'Segoe UI', sans-serif" fontSize="46" fontWeight="800" letterSpacing="-2">
        <tspan fontWeight="300" fill="#c0c0c0">Ever</tspan>
        <tspan fill="url(#wgrad)" filter="url(#glow)"> Sense</tspan>
        <tspan fill="url(#aigl)" filter="url(#glow)" fontSize="32"> Ai</tspan>
      </text>

      {/* Tagline */}
      <line x1="132" y1="70" x2="132" y2="94" stroke="#007acc" strokeWidth="1.5" opacity="0.6" />
      <text x="142" y="88" fontFamily="'Segoe UI', sans-serif" fontSize="12" fontWeight="400" fill="#909090" letterSpacing="2.5">INTELLIGENT PLATFORM</text>
    </svg>
  );
}
