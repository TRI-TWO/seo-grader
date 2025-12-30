"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center cursor-pointer">
      <Image
        src="/tri-two-logo.svg"
        alt="TRI-TWO Logo"
        width={120}
        height={142}
        className="flex-shrink-0"
        priority
      />
    </Link>
  );
}

