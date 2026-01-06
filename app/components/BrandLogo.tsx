"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface BrandLogoProps {
  variant?: 'mark' | 'lockup';
  size?: number;
  className?: string;
  priority?: boolean;
}

export default function BrandLogo({ 
  variant = 'lockup', 
  size = 240, 
  className = '',
  priority = false 
}: BrandLogoProps) {
  // For now, we only have the lockup version
  // The mark variant would be tri-two-logo-nw.svg (no wordmark)
  const logoSrc = variant === 'mark' ? '/tri-two-logo-nw.svg' : '/tri-two-logo.svg';
  const logoHeight = variant === 'mark' ? Math.round(size * 0.83) : Math.round(size * 1.18);

  return (
    <Link href="/" className={`flex items-center cursor-pointer ${className}`}>
      <Image
        src={logoSrc}
        alt="TRI-TWO Logo"
        width={size}
        height={logoHeight}
        className="flex-shrink-0"
        priority={priority}
      />
    </Link>
  );
}

