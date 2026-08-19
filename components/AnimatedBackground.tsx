'use client';

import { usePathname } from 'next/navigation';

// Encapsulates the global .av-bg/.av-noise layers (perspective grid,
// scanlines, vignette, SVG-filter noise) so they can be skipped on
// */play routes, where they'd otherwise compete for compositor/GPU
// time with a game's canvas.
export default function AnimatedBackground() {
  const pathname = usePathname();
  const isPlayPage = pathname.endsWith('/play');

  if (isPlayPage) return null;

  return (
    <>
      <div className="av-bg" />
      <div className="av-noise" />
    </>
  );
}
