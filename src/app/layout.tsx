import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ImpersonationBanner from "@/features/shared/components/ImpersonationBanner";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Territory Plan Builder | Fullmind",
  description: "Interactive territory planning for school district visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} antialiased font-sans`}>
        <ImpersonationBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
