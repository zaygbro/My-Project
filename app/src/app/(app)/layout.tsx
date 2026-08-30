import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Same display face the marketing site uses for its headlines — without
// this, every heading in the app renders in Geist Sans while the marketing
// site's renders in Space Grotesk, which is the single biggest reason the
// two halves of the product read as different apps sharing a color.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Francisity — Account",
  description: "Sign in, manage billing, and create sites with Francisity.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="dark"
          richColors
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0a0a0a",
              border: "1px solid #262626",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
