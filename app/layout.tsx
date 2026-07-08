import type { Metadata, Viewport } from "next";
import { Montserrat, Patrick_Hand, Amatic_SC, Love_Ya_Like_A_Sister, Cormorant_Garamond, Instrument_Serif, Chelsea_Market, Nunito } from "next/font/google";
import "./globals.css";
import BonkyFlying from "./components/BonkyFlying";

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

export const metadata: Metadata = {
  title: "Bonkers Book Club",
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
    <html lang="en" className={`${montserrat.variable} ${patrickHand.variable} ${amaticSC.variable} ${loveYa.variable} ${cormorant.variable} ${instrumentSerif.variable} ${chelseaMarket.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-montserrat)]" style={{ position: 'relative' }}>
        {/* Full-screen background — always fills the viewport */}
        <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: -1 }} />
        {/* Content constrained to phone width, centred */}
        <div style={{ width: '100%', maxWidth: '768px', margin: '0 auto', position: 'relative', minHeight: '100vh' }}>
          <img src="/moon.png" alt="" style={{ position: 'absolute', top: '52px', left: '40px', width: '52px', height: 'auto', zIndex: 50, pointerEvents: 'none' }} />
          <BonkyFlying />
          {children}
        </div>
      </body>
    </html>
  );
}
