import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sparkoff | 3D Yazıcı Randevu Sistemi",
  description: "Okul atölyesindeki 3D yazıcılar için dosyanı yükle, zamanını seç ve baskı sürecini takip et.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="tr"><body>{children}</body></html>;
}
