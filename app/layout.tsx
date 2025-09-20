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
  title: "iWheeli.com - Free Random Name Wheel Spinner | Cryptographically Secure",
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
    title: "iWheeli.com - Free Random Name Wheel Spinner",
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
    title: "iWheeli.com - Free Random Name Wheel Spinner",
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
  maximumScale: 5,
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
        {/* Google Tag Manager - Script */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <Script id="gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');
            `}
          </Script>
        )}

        {/* Google Tag Manager - noscript */}
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

        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_TRACKING_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_TRACKING_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_TRACKING_ID}', {
                  debug_mode: ${process.env.NODE_ENV === 'development'},
                  send_page_view: true
                });

                // Log GA initialization for debugging
                console.log('Google Analytics initialized with ID: ${process.env.NEXT_PUBLIC_GA_TRACKING_ID}');

                // Make gtag available globally for custom events
                window.gtag = gtag;
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
