import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Toaster } from "sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "JobGenie — Tailored Resumes That Get Interviews", template: "%s | JobGenie" },
  description: "AI-powered resume tailoring and job tracking platform",
  keywords: ["resume", "ATS", "AI resume tailor", "job application", "career"],
  openGraph: {
    title: "JobGenie — Tailored Resumes That Get Interviews",
    description: "AI-powered resume tailoring and ATS optimization",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
