export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from "next";
import { Montserrat, Patrick_Hand, Amatic_SC, Love_Ya_Like_A_Sister, Cormorant_Garamond, Instrument_Serif, Chelsea_Market, Nunito, Caveat } from "next/font/google";
import "./globals.css";
import MoonDisplay from "./components/MoonDisplay";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-patrick-hand",
});

const amaticSC = Amatic_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-amatic",
});

const loveYa = Love_Ya_Like_A_Sister({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-loveya",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-cormorant",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
});

const chelseaMarket = Chelsea_Market({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-chelsea",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Bonkers — The Children's Library",
  description: "Dubai's most magical children's book swap",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${patrickHand.variable} ${amaticSC.variable} ${loveYa.variable} ${cormorant.variable} ${instrumentSerif.variable} ${chelseaMarket.variable} ${nunito.variable} ${caveat.variable}`}>
      <body className="flex flex-col font-[family-name:var(--font-montserrat)]">
        {/* Full-screen background — always fills the viewport */}
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fefaf2', zIndex: -1 }} />
        {/* Content constrained to iPad Pro width, centred */}
        <div className="main-wrapper" style={{ width: '100%', maxWidth: '768px', margin: '0 auto', position: 'relative', minHeight: '100vh' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
