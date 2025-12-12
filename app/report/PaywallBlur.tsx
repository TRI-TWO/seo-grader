"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface PaywallBlurProps {
  children: React.ReactNode;
  isPaywalled?: boolean;
  className?: string;
}

export default function PaywallBlur({ children, isPaywalled = true, className = "" }: PaywallBlurProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!user;
  
  // Debug: Verify component is rendering
  if (typeof window !== 'undefined' && !loading) {
    console.log('PaywallBlur rendering, isPaywalled:', isPaywalled, 'isAuthenticated:', isAuthenticated);
  }
  
  // If user is authenticated, bypass paywall
  if (!isPaywalled || isAuthenticated) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        position: 'relative', 
        minHeight: '60px',
        isolation: 'isolate'
      }}
    >
      {/* Blurred content - showing actual results but blurred */}
      <div 
        style={{ 
          filter: 'blur(25px)',
          WebkitFilter: 'blur(25px)',
          msFilter: 'blur(25px)',
          opacity: 0.3,
          userSelect: 'none',
          pointerEvents: 'none',
          position: 'relative',
          zIndex: 1,
          transform: 'scale(1.01)'
        }}
      >
        {children}
      </div>
      
      {/* Dark overlay to enhance blur effect */}
      <div 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      />
      
      {/* Overlay with "Unlock to see" text bubble */}
      <div 
        style={{ 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div 
          style={{
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '16px',
            backgroundColor: '#9333ea',
            border: '3px solid #a855f7',
            boxShadow: '0 10px 30px rgba(147, 51, 234, 0.8), 0 0 20px rgba(147, 51, 234, 0.4)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            whiteSpace: 'nowrap'
          }}
        >
          Unlock to see
        </div>
      </div>
    </div>
  );
}
