import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/components/NotificationProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserProvider } from "@/components/UserProvider";
import { CartButton, CartModal } from "@/components/Cart";
import { BottomNav } from "@/components/BottomNav";
import { HowItWorks } from "@/components/HowItWorks";
import { HapticProvider } from "@/components/HapticProvider";
import { RevealProvider } from "@/components/bongo/Motion";
import "./globals.css";

// Bongo Life type system: Archivo as the condensed poster display face (the
// variable width axis is what gives headlines their squeeze), Plus Jakarta Sans
// for running text. Geist Mono is kept for figures and tickers, where tabular
// digits still matter more than personality.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  // Full variable font: the wdth axis is what lets headlines squeeze, and Next
  // only allows axes to be requested when the weight stays variable.
  axes: ["wdth"],
});
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Native-app-like viewport: lock scale so the UI never appears zoomed (and iOS
// doesn't auto-zoom when focusing inputs), and extend under the notch/home bar
// so safe-area insets can be used for stable, full-bleed layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  title: "GUAP — Predict the Future. Earn GUAP.",
  description: "Trade YES or NO on African events. Politics, sports, business. Powered by nTZS. Africa's first prediction market.",
  keywords: ["predictions", "Africa", "TZS", "markets", "GUAP", "Mobile Money", "nTZS", "trading"],
  metadataBase: new URL("https://guap.gold"),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/guap.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "GUAP",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "GUAP — Predict the Future. Earn GUAP.",
    description: "Trade YES or NO on African events. Politics, sports, business. Powered by nTZS.",
    siteName: "GUAP",
    type: "website",
    images: [{ url: "/og-guap.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GUAP — Predict the Future. Earn GUAP.",
    description: "Trade YES or NO on African events. Politics, sports, business. Powered by nTZS.",
    images: ["/og-guap.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <body className={`${archivo.variable} ${jakarta.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <LanguageProvider>
            <UserProvider>
              <NotificationProvider>
                {/* Global haptics: vibrate on touch taps of any button/link */}
                <HapticProvider />
                {/* Scroll-staging for every screen, not just the landing */}
                <RevealProvider />
                {/* Status-bar filler: covers the notch/status-bar area with a solid
                    bar in the installed (standalone) app so page content scrolling
                    behind it isn't visible under the status bar. 0px in the browser. */}
                <div
                  aria-hidden
                  className="fixed top-0 left-0 right-0 z-[45] bg-[var(--background)] pointer-events-none"
                  style={{ height: "env(safe-area-inset-top)" }}
                />
                {/* Bottom padding on mobile so content clears the fixed bottom nav
                    (plus the device safe-area inset on notched phones). */}
                <div className="pb-bottomnav md:pb-0">{children}</div>
                <CartButton />
                <CartModal />
                {/* "How it works" explainer above the bottom nav — logged-out users only */}
                <HowItWorks />
                <BottomNav />
              </NotificationProvider>
            </UserProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
