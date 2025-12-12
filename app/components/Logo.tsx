"use client";

import React from "react";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 cursor-pointer">
      <div className="relative flex items-center" style={{ height: '80px' }}>
        {/* Container for diamonds and text */}
        <div className="relative flex items-center" style={{ width: '200px', height: '80px' }}>
          {/* Four diamond shapes arranged horizontally */}
          {/* Red diamond (left) */}
          <div 
            className="absolute"
            style={{
              left: '0px',
              width: '40px',
              height: '80px',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              backgroundColor: '#ef4444',
              zIndex: 1
            }}
          />
          
          {/* Purple diamond */}
          <div 
            className="absolute"
            style={{
              left: '40px',
              width: '40px',
              height: '80px',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              backgroundColor: '#9334e9',
              zIndex: 1
            }}
          />
          
          {/* Green diamond */}
          <div 
            className="absolute"
            style={{
              left: '80px',
              width: '40px',
              height: '80px',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              backgroundColor: '#16b8a6',
              zIndex: 1
            }}
          />
          
          {/* Orange diamond (right) */}
          <div 
            className="absolute"
            style={{
              left: '120px',
              width: '40px',
              height: '80px',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              backgroundColor: '#f97315',
              zIndex: 1
            }}
          />
          
          {/* White horizontal line cutting across all diamonds */}
          <div 
            className="absolute bg-white"
            style={{
              left: '0px',
              width: '160px',
              height: '2px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2
            }}
          />
          
          {/* TRI text above line - letters centered on first 3 diamonds */}
          <div className="absolute" style={{ top: '10px', left: '0px', width: '160px', display: 'flex', justifyContent: 'space-around', zIndex: 3 }}>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>T</span>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>R</span>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>I</span>
          </div>
          
          {/* TWO text below line - letters centered on first 3 diamonds */}
          <div className="absolute" style={{ bottom: '10px', left: '0px', width: '160px', display: 'flex', justifyContent: 'space-around', zIndex: 3 }}>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>T</span>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>W</span>
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>O</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

