import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners",
  description:
    "Free online random name wheel spinner with cryptographically secure randomness. Perfect for classroom activities, team selection, giveaways, and decision making. No ads, no signup required.",
  keywords: "random wheel, name picker, wheel spinner, random name generator, decision wheel, spinner wheel, classroom tool, team selector, raffle wheel, fortune wheel, random picker, free spinner",
  authors: [{ name: "iWheeli" }],
  creator: "iWheeli",
  publisher: "iWheeli",
  metadataBase: new URL("https://iwheeli.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners",
    description: "Free online random name wheel spinner with cryptographically secure randomness. Perfect for classroom activities, team selection, and decision making.",
    url: "https://iwheeli.com",
    siteName: "iWheeli",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "iWheeli - Random Name Wheel Spinner",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners",
    description: "Free online random name wheel spinner with cryptographically secure randomness. No ads, no signup required.",
    images: ["/logo.png"],
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
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/favicon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
};

export const viewport = {
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
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Optimized Analytics - Load after page is interactive */}
        {(process.env.NEXT_PUBLIC_GTM_ID || process.env.NEXT_PUBLIC_GA_TRACKING_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) && (
          <Script id="analytics-loader" strategy="lazyOnload">
            {`
              // Initialize dataLayer first
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}

              // Load analytics after a small delay to not block main thread
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
              }, 100); // Small delay to let critical content load first
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
