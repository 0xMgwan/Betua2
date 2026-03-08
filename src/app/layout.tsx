import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GUAP — Tanzania's Prediction Market",
  description: "Predict, trade and earn on real-world events with Tanzanian Shillings.",
  keywords: ["predictions", "Tanzania", "TZS", "markets", "betting"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
