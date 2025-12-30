"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 cursor-pointer">
      <Image
        src="/tri-two-logo.svg"
        alt="TRI-TWO Logo"
        width={40}
        height={40}
        className="flex-shrink-0"
        priority
      />
      <span className="text-white text-xl font-bold tracking-tight uppercase" style={{ fontFamily: 'system-ui, sans-serif' }}>
        TRI-TWO
      </span>
    </Link>
  );
}

