import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Improve font loading
  preload: true,
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["monospace"],
});

const SITE_URL = "https://iwheeli.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const HAS_ANALYTICS = Boolean(
  process.env.NEXT_PUBLIC_GTM_ID ||
    process.env.NEXT_PUBLIC_GA_TRACKING_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
);

// Social preview images come from app/opengraph-image.tsx (and app/[slug]/opengraph-image.tsx
// for shared wheels); Next.js wires those into the OpenGraph/Twitter tags automatically.
export const metadata: Metadata = {
  title: "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners",
  description:
    "Free online random name wheel spinner with cryptographically secure randomness. Perfect for classroom activities, team selection, giveaways, and decision making. No ads, no signup required.",
  keywords: "random wheel, name picker, wheel spinner, random name generator, decision wheel, spinner wheel, classroom tool, team selector, raffle wheel, fortune wheel, random picker, free spinner",
  authors: [{ name: "iWheeli" }],
  creator: "iWheeli",
  publisher: "iWheeli",
  applicationName: "iWheeli",
  category: "utilities",
  metadataBase: new URL(SITE_URL),
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners",
    description: "Free online random name wheel spinner with cryptographically secure randomness. Perfect for classroom activities, team selection, and decision making.",
    url: SITE_URL,
    siteName: "iWheeli",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners",
    description: "Free online random name wheel spinner with cryptographically secure randomness. No ads, no signup required.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
};

// Pinch-zoom is intentionally disabled: the wheel is a drag/spin surface and
// accidental zooms on mobile break the interaction.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1e40af",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'iWheeli',
    url: SITE_URL,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    description: 'Free online random name wheel spinner with cryptographically secure randomness. Perfect for classroom activities, team selection, giveaways, and decision making.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'iWheeli',
      url: SITE_URL,
    },
  };

  return (
    <html lang="en">
      <head>
        {/* Warm up connections we will use shortly after load */}
        {SUPABASE_URL && (
          <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
        )}
        {HAS_ANALYTICS && (
          <link rel="preconnect" href="https://www.googletagmanager.com" />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Optimized Analytics - Load after page is interactive with longer delay for mobile */}
        {HAS_ANALYTICS && (
          <Script id="analytics-loader" strategy="afterInteractive">
            {`
              // Initialize dataLayer first
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}

              // Detect mobile and use longer delay
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              const delay = isMobile ? 3000 : 100; // 3s for mobile, 100ms for desktop

              // Load analytics after delay to not block main thread
              setTimeout(() => {
                ${process.env.NEXT_PUBLIC_GTM_ID ? `
                  // Google Tag Manager
                  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                  })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');
                ` : ''}

                ${process.env.NEXT_PUBLIC_GA_TRACKING_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ? `
                  // Google Analytics & Google Ads - Use single gtag.js script
                  var gtagScript = document.createElement('script');
                  gtagScript.async = true;
                  // Use GA ID if available, otherwise use Google Ads ID
                  gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_TRACKING_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}';
                  document.head.appendChild(gtagScript);

                  gtagScript.onload = function() {
                    gtag('js', new Date());

                    ${process.env.NEXT_PUBLIC_GA_TRACKING_ID ? `
                      // Configure Google Analytics
                      gtag('config', '${process.env.NEXT_PUBLIC_GA_TRACKING_ID}', {
                        send_page_view: true
                      });
                    ` : ''}

                    ${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ? `
                      // Configure Google Ads
                      gtag('config', '${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}');
                    ` : ''}

                    // Make gtag available globally for custom events
                    window.gtag = gtag;
                  };
                ` : ''}
              }, delay); // Dynamic delay based on device type
            `}
          </Script>
        )}

        {/* Google Tag Manager - noscript fallback */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {children}
      </body>
    </html>
  );
}
