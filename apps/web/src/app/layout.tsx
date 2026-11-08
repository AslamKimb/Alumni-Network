import type { Metadata } from "next";
import { DM_Sans, Fira_Code, Plus_Jakarta_Sans } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alumni Network",
  description: "A private alumni registry for your institution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${jakarta.variable} ${firaCode.variable} antialiased`}>
        <Providers>
          <div className="flex min-h-svh flex-col">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
