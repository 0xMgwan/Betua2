import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/components/NotificationProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CartButton, CartModal } from "@/components/Cart";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <LanguageProvider>
            <NotificationProvider>
              {children}
              <CartButton />
              <CartModal />
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
