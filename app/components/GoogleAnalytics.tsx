'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'

export default function GoogleAnalytics() {
  const pathname = usePathname()
  
  // Don't render on admin pages
  if (pathname?.startsWith('/admin')) {
    return null
  }
  
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-YD6N8SY058"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-YD6N8SY058');
        `}
      </Script>
    </>
  )
}

