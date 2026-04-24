// Ankaa Design color palette
// Dark charcoal: #1e1e2e
// Green primary: #3bc914
// Green dark:    #27a50a
// Gold accent:   #c8a84b
// White:         #ffffff
// Light surface: #f0fdf4

export const HeaderWaveGreen = () => (
  <svg
    width="100%"
    height="120"
    viewBox="0 0 1200 120"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hwg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* Dark bg */}
    <rect x="0" y="0" width="1200" height="120" fill="#1e1e2e" />
    {/* White area below wave */}
    <path d="M 0,86 C 360,56 840,116 1200,82 L 1200,120 L 0,120 Z" fill="#ffffff" />
    {/* Green ribbon */}
    <path d="M 0,72 C 360,42 840,102 1200,68 L 1200,86 C 840,116 360,56 0,86 Z" fill="url(#hwg-grad)" />
    {/* Gold stripe */}
    <path d="M 0,64 C 360,34 840,94 1200,60 L 1200,67 C 840,101 360,41 0,71 Z" fill="#c8a84b" />
  </svg>
);

export const HeaderDiagonal = () => (
  <svg
    width="100%"
    height="120"
    viewBox="0 0 1200 120"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hd-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* White background */}
    <rect x="0" y="0" width="1200" height="120" fill="#ffffff" />
    {/* Dark diagonal block */}
    <path d="M 0,0 L 1200,0 L 1200,40 L 700,120 L 0,120 Z" fill="#1e1e2e" />
    {/* Green band */}
    <path d="M 700,120 L 1200,40 L 1200,56 L 718,120 Z" fill="url(#hd-grad)" />
    {/* Gold thin line */}
    <path d="M 718,120 L 1200,56 L 1200,62 L 724,120 Z" fill="#c8a84b" />
  </svg>
);

export const HeaderStripe = () => (
  <svg
    width="100%"
    height="96"
    viewBox="0 0 1200 96"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hs-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#27a50a" />
        <stop offset="50%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* Dark band */}
    <rect x="0" y="0" width="1200" height="68" fill="#1e1e2e" />
    {/* Gold top edge of green */}
    <rect x="0" y="68" width="1200" height="3" fill="#c8a84b" />
    {/* Green band */}
    <rect x="0" y="71" width="1200" height="17" fill="url(#hs-grad)" />
    {/* White area */}
    <rect x="0" y="88" width="1200" height="8" fill="#ffffff" />
  </svg>
);

export const HeaderArc = () => (
  <svg
    width="100%"
    height="120"
    viewBox="0 0 1200 120"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="ha-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* Dark bg */}
    <rect x="0" y="0" width="1200" height="120" fill="#1e1e2e" />
    {/* White arc */}
    <path d="M 0,92 Q 600,58 1200,92 L 1200,120 L 0,120 Z" fill="#ffffff" />
    {/* Green ribbon */}
    <path d="M 0,82 Q 600,48 1200,82 L 1200,94 Q 600,60 0,94 Z" fill="url(#ha-grad)" />
    {/* Gold arc */}
    <path d="M 0,76 Q 600,42 1200,76 L 1200,81 Q 600,47 0,81 Z" fill="#c8a84b" />
  </svg>
);

export const HeaderChevron = () => (
  <svg
    width="100%"
    height="120"
    viewBox="0 0 1200 120"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hch-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* Dark bg */}
    <rect x="0" y="0" width="1200" height="120" fill="#1e1e2e" />
    {/* White chevron */}
    <path d="M 0,72 L 600,106 L 1200,72 L 1200,120 L 0,120 Z" fill="#ffffff" />
    {/* Green ribbon */}
    <path d="M 0,62 L 600,96 L 1200,62 L 1200,74 L 600,108 L 0,74 Z" fill="url(#hch-grad)" />
    {/* Gold edge */}
    <path d="M 0,57 L 600,91 L 1200,57 L 1200,62 L 600,96 L 0,62 Z" fill="#c8a84b" />
  </svg>
);

export const HeaderGradient = () => (
  <svg
    width="100%"
    height="120"
    viewBox="0 0 1200 120"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="hgr-bg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#1e1e2e" />
        <stop offset="100%" stopColor="#152b15" />
      </linearGradient>
      <linearGradient id="hgr-glow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" stopOpacity="0" />
        <stop offset="50%" stopColor="#3bc914" stopOpacity="1" />
        <stop offset="100%" stopColor="#3bc914" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Background */}
    <rect x="0" y="0" width="1200" height="120" fill="url(#hgr-bg)" />
    {/* Right-side green glow */}
    <rect x="500" y="0" width="700" height="120" fill="url(#hgr-glow)" opacity="0.18" />
    {/* Gold horizontal line */}
    <rect x="0" y="100" width="1200" height="2" fill="#c8a84b" />
    {/* Green line */}
    <rect x="0" y="102" width="1200" height="5" fill="#3bc914" />
    {/* White strip */}
    <rect x="0" y="107" width="1200" height="13" fill="#ffffff" />
  </svg>
);

export const FooterWaveAnkaa = () => (
  <svg
    width="100%"
    height="160"
    viewBox="0 0 1200 160"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="fwa-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* White bg */}
    <rect x="0" y="0" width="1200" height="160" fill="#ffffff" />
    {/* Dark area */}
    <path d="M 0,72 C 360,104 840,42 1200,76 L 1200,160 L 0,160 Z" fill="#1e1e2e" />
    {/* Green ribbon */}
    <path d="M 0,60 C 360,92 840,30 1200,64 L 1200,74 C 840,40 360,102 0,70 Z" fill="url(#fwa-grad)" />
    {/* Gold stripe */}
    <path d="M 0,53 C 360,85 840,23 1200,57 L 1200,61 C 840,27 360,89 0,57 Z" fill="#c8a84b" />
    {/* ANKAA text */}
    <text
      x="1160"
      y="128"
      textAnchor="end"
      fontFamily="system-ui,-apple-system,sans-serif"
      fontSize="19"
      fontWeight="700"
      fill="#ffffff"
      letterSpacing="3"
    >
      ANKAA
    </text>
    {/* design text */}
    <text
      x="1160"
      y="148"
      textAnchor="end"
      fontFamily="system-ui,-apple-system,sans-serif"
      fontSize="11"
      fontStyle="italic"
      fill="#3bc914"
      letterSpacing="1"
    >
      design
    </text>
    {/* Copyright line 1 */}
    <text
      x="32"
      y="126"
      fontFamily="system-ui,-apple-system,sans-serif"
      fontSize="9"
      fill="#6b7a8d"
    >
      Este material está protegido pela lei do direito autoral.
    </text>
    {/* Copyright line 2 */}
    <text
      x="32"
      y="140"
      fontFamily="system-ui,-apple-system,sans-serif"
      fontSize="9"
      fill="#6b7a8d"
    >
      Reprodução proibida sem autorização expressa.
    </text>
  </svg>
);

export const FooterWaveSimple = () => (
  <svg
    width="100%"
    height="120"
    viewBox="0 0 1200 120"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="fws-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* White bg */}
    <rect x="0" y="0" width="1200" height="120" fill="#ffffff" />
    {/* Dark area */}
    <path d="M 0,52 C 360,84 840,22 1200,56 L 1200,120 L 0,120 Z" fill="#1e1e2e" />
    {/* Green ribbon */}
    <path d="M 0,40 C 360,72 840,10 1200,44 L 1200,54 C 840,20 360,82 0,50 Z" fill="url(#fws-grad)" />
    {/* Gold */}
    <path d="M 0,33 C 360,65 840,3 1200,37 L 1200,40 C 840,6 360,68 0,36 Z" fill="#c8a84b" />
  </svg>
);

export const FooterBar = () => (
  <svg
    width="100%"
    height="80"
    viewBox="0 0 1200 80"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="fb-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#27a50a" />
        <stop offset="50%" stopColor="#3bc914" />
        <stop offset="100%" stopColor="#27a50a" />
      </linearGradient>
    </defs>
    {/* White bg */}
    <rect x="0" y="0" width="1200" height="80" fill="#ffffff" />
    {/* Gold line */}
    <rect x="0" y="42" width="1200" height="3" fill="#c8a84b" />
    {/* Green band */}
    <rect x="0" y="45" width="1200" height="16" fill="url(#fb-grad)" />
    {/* Dark base */}
    <rect x="0" y="61" width="1200" height="19" fill="#1e1e2e" />
  </svg>
);

export const FooterGradient = () => (
  <svg
    width="100%"
    height="56"
    viewBox="0 0 1200 56"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="fg-fade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="100%" stopColor="#1e1e2e" stopOpacity="1" />
      </linearGradient>
    </defs>
    {/* Fade rect */}
    <rect x="0" y="0" width="1200" height="56" fill="url(#fg-fade)" />
    {/* Gold line */}
    <rect x="0" y="0" width="1200" height="2" fill="#c8a84b" opacity="0.7" />
    {/* Green line */}
    <rect x="0" y="2" width="1200" height="4" fill="#3bc914" opacity="0.9" />
  </svg>
);

export const SideLeftStripe = () => (
  <svg
    width="44"
    height="400"
    viewBox="0 0 44 400"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="sls-vert" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="50%" stopColor="#27a50a" />
        <stop offset="100%" stopColor="#3bc914" />
      </linearGradient>
    </defs>
    {/* Light surface bg */}
    <rect x="0" y="0" width="44" height="400" fill="#f0fdf4" />
    {/* Green bar */}
    <rect x="0" y="0" width="6" height="400" fill="url(#sls-vert)" />
    {/* Gold edge */}
    <rect x="6" y="0" width="2" height="400" fill="#c8a84b" />
  </svg>
);

export const SideRightStripe = () => (
  <svg
    width="44"
    height="400"
    viewBox="0 0 44 400"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="srs-vert" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3bc914" />
        <stop offset="50%" stopColor="#27a50a" />
        <stop offset="100%" stopColor="#3bc914" />
      </linearGradient>
    </defs>
    {/* Light surface bg */}
    <rect x="0" y="0" width="44" height="400" fill="#f0fdf4" />
    {/* Gold */}
    <rect x="34" y="0" width="2" height="400" fill="#c8a84b" />
    {/* Green bar */}
    <rect x="36" y="0" width="6" height="400" fill="url(#srs-vert)" />
  </svg>
);

export const SideLeftCorner = () => (
  <svg
    width="100%"
    height="80"
    viewBox="0 0 1200 80"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="slc-fade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" stopOpacity="1" />
        <stop offset="100%" stopColor="#3bc914" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Light surface */}
    <rect x="0" y="0" width="1200" height="80" fill="#f0fdf4" />
    {/* Left green bar */}
    <rect x="0" y="0" width="6" height="80" fill="#3bc914" />
    {/* Gold top line */}
    <rect x="6" y="0" width="1194" height="2" fill="#c8a84b" />
    {/* Fade overlay */}
    <rect x="6" y="2" width="440" height="78" fill="url(#slc-fade)" opacity="0.10" />
    {/* Gold bottom line */}
    <rect x="6" y="78" width="1194" height="2" fill="#c8a84b" opacity="0.4" />
  </svg>
);

export const SideRightCorner = () => (
  <svg
    width="100%"
    height="80"
    viewBox="0 0 1200 80"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="src-fade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3bc914" stopOpacity="0" />
        <stop offset="100%" stopColor="#3bc914" stopOpacity="1" />
      </linearGradient>
    </defs>
    {/* Light surface */}
    <rect x="0" y="0" width="1200" height="80" fill="#f0fdf4" />
    {/* Gold top */}
    <rect x="0" y="0" width="1194" height="2" fill="#c8a84b" />
    {/* Fade */}
    <rect x="754" y="2" width="440" height="78" fill="url(#src-fade)" opacity="0.10" />
    {/* Gold bottom */}
    <rect x="0" y="78" width="1194" height="2" fill="#c8a84b" opacity="0.4" />
    {/* Right green bar */}
    <rect x="1194" y="0" width="6" height="80" fill="#3bc914" />
  </svg>
);

export const FooterAnkaa1 = () => (
  <svg
    width="100%"
    viewBox="0 0 645 131.89"
    preserveAspectRatio="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="fa1-green" x1="25.69" y1="53.66" x2="608.13" y2="53.66" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#0c884e"/>
        <stop offset="1" stopColor="#00a357"/>
      </linearGradient>
      <linearGradient id="fa1-gold" x1="22" y1="45.45" x2="556.53" y2="45.45" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#aaabaf"/>
        <stop offset=".47" stopColor="#cec580"/>
        <stop offset="1" stopColor="#aaabaf"/>
      </linearGradient>
    </defs>
    {/* Full-width dark base — fills side gaps that the wave path doesn't cover */}
    <rect x="0" y="43" width="645" height="88.89" fill="#4b4b4d"/>
    {/* Dark lower section — wave-shaped top edge (original, unchanged) */}
    <path fill="#4b4b4d" d="M617.28,43.62v88.27H22V47.52c1.02.61,2.22,1.33,3.69,2.11,7.3,5.28,59.71,39.5,178.2,27.51,101.84-8.99,230.04-29.27,283.99-33.08,0,0,76.41-5.43,120.25-2.47l9.15,2.03Z"/>
    {/* Green wave ribbon */}
    <path fill="url(#fa1-green)" d="M608.13,41.59c-43.84-2.96-120.25,2.47-120.25,2.47-53.95,3.81-182.15,24.09-283.99,33.08-118.49,11.99-170.9-22.23-178.2-27.51,13.81,7.37,51.65,20.64,194.22,5.22,50.31-5.29,96.21-10.26,137.84-14.24,82.72-7.92,148.59-11.94,198.78-6.9-2.09-.35-27.68-2.64-27.68-2.64-55.57-5.63-151.93,1.55-151.93,1.55-13.11.98-44.62,4.61-80.5,8.87-43.05,5.1-92.4,11.1-123.8,14.49-55.57,6.01-96.73,1.31-100.7.82,30.55,2.55,77.57,1.7,149.24-8.64,16.64-2.27,32.75-4.36,48.36-6.28,143.41-17.62,245.43-20.18,338.61-.29Z"/>
    {/* Gold stripe */}
    <path fill="url(#fa1-gold)" d="M556.53,33.71c-50.19-5.04-116.06-1.02-198.78,6.9-41.63,3.98-87.53,8.95-137.84,14.24-142.57,15.42-180.41,2.15-194.22-5.22-1.47-.78-2.67-1.5-3.69-2.11v-2.09s.03.01.04.02c6.18,3.26,20.27,8.86,49.57,11.32.04,0,.08.01.12.01.05.01.11.01.19.02,3.97.49,45.13,5.19,100.7-.82,31.4-3.39,80.75-9.39,123.8-14.49,35.88-4.26,67.39-7.89,80.5-8.87,0,0,96.36-7.18,151.93-1.55,0,0,25.59,2.29,27.68,2.64Z"/>
  </svg>
);

// Keep old name as alias for backward compatibility
export const HeaderCornerAccent = HeaderArc;
