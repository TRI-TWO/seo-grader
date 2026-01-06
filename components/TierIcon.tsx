"use client";

import React from "react";

type TierIconType = 'compass' | 'plant' | 'ball';

interface TierIconProps {
  tier: TierIconType;
  className?: string;
  size?: number;
}

export default function TierIcon({ tier, className = '', size = 24 }: TierIconProps) {
  // The SVG file contains all three icons
  // We'll use the SVG directly with a viewBox to show the appropriate icon
  // For now, we'll display the full SVG - the icons should be visible
  // Compass = Starter, Plant = Growth, Ball = Accelerate
  
  return (
    <div className={`inline-flex items-center ${className}`} style={{ width: size, height: size }}>
      <img
        src="/tier-icons.svg"
        alt={`${tier} icon`}
        width={size}
        height={size}
        className="object-contain"
        style={{ display: 'inline-block' }}
      />
    </div>
  );
}

