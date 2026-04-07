import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get("next") ?? "/dashboard"
  const supabase = await createClient()

  // ── Path 1: Email confirmation / OTP (token_hash + type) ──
  // Used for: email verification, password recovery
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) {
      console.error("[auth/callback] verifyOtp error:", error.message)
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent(error.message)}`
      )
    }
    // For password recovery, redirect to reset page
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/auth/reset-password`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // ── Path 2: OAuth PKCE code exchange ──
  // Used for: Google OAuth, magic links
  const code = searchParams.get("code")
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message)
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent(error.message)}`
      )
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // ── Fallback: no usable params ──
  console.warn("[auth/callback] No token_hash or code in query params")
  return NextResponse.redirect(
    `${origin}/auth/error?message=${encodeURIComponent("Invalid or expired verification link")}`
  )
}
