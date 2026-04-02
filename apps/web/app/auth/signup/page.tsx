"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Zap, AlertCircle, Loader2, Mail, CheckCircle2, RefreshCw } from "lucide-react"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()
    // Keep emailRedirectTo clean — no query params, so Supabase URL matching works
    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // identities=[] means this email is already registered (Supabase returns fake success)
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError("An account with this email already exists. Please sign in instead.")
      return
    }

    // session present = email confirmation is disabled in Supabase dashboard
    if (data.session) {
      window.location.href = "/dashboard"
      return
    }

    // Normal path: confirmation email was sent
    setSent(true)
  }

  const handleResend = async () => {
    setResending(true)
    setResendSuccess(false)
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setResending(false)
    if (resendError) {
      setError(resendError.message)
    } else {
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#f0f0ff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a14",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
              }}
            >
              <Zap style={{ width: "20px", height: "20px", color: "#fff" }} strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: "20px", letterSpacing: "-0.5px", color: "#f0f0ff" }}>
              YuktiHire
            </span>
          </Link>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#12121f",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.08)",
          }}
        >
          {sent ? (
            /* ── Email sent / verification state ── */
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.1))",
                  border: "1px solid rgba(52,211,153,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Mail style={{ width: "28px", height: "28px", color: "#34d399" }} />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <CheckCircle2 style={{ width: "18px", height: "18px", color: "#34d399" }} />
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0ff", margin: 0 }}>
                  Check your email
                </h2>
              </div>

              <p
                style={{
                  fontSize: "14px",
                  color: "rgba(240,240,255,0.5)",
                  lineHeight: "1.6",
                  marginBottom: "20px",
                }}
              >
                We sent a confirmation link to{" "}
                <strong style={{ color: "#a78bfa" }}>{email}</strong>.
                <br />
                Click it to activate your account and sign in.
              </p>

              {/* Steps */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "rgba(108,99,255,0.07)",
                  border: "1px solid rgba(108,99,255,0.18)",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  textAlign: "left",
                }}
              >
                {[
                  "Open the email from YuktiHire",
                  'Click "Confirm your email"',
                  "You'll be signed in automatically",
                ].map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      marginBottom: i < 2 ? "10px" : 0,
                    }}
                  >
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "rgba(108,99,255,0.2)",
                        border: "1px solid rgba(108,99,255,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#a78bfa",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: "13px", color: "rgba(240,240,255,0.6)", lineHeight: 1.5 }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              {/* Spam warning */}
              <p
                style={{
                  fontSize: "12px",
                  color: "rgba(240,240,255,0.35)",
                  marginBottom: "20px",
                  lineHeight: 1.5,
                }}
              >
                Can't find it? Check your spam or promotions folder.
              </p>

              {/* Resend */}
              {resendSuccess ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "10px",
                    background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.2)",
                    borderRadius: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <CheckCircle2 style={{ width: "14px", height: "14px", color: "#34d399" }} />
                  <span style={{ fontSize: "13px", color: "#34d399", fontWeight: 500 }}>
                    Verification email resent!
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "11px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    color: "rgba(240,240,255,0.7)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: resending ? "not-allowed" : "pointer",
                    marginBottom: "16px",
                    opacity: resending ? 0.6 : 1,
                    transition: "background 0.2s",
                  }}
                >
                  {resending ? (
                    <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
                  ) : (
                    <RefreshCw style={{ width: "14px", height: "14px" }} />
                  )}
                  {resending ? "Resending..." : "Resend verification email"}
                </button>
              )}

              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <AlertCircle style={{ width: "14px", height: "14px", color: "#f87171", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "#f87171" }}>{error}</span>
                </div>
              )}

              <Link
                href="/auth/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  color: "#a78bfa",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to login
              </Link>
            </div>
          ) : (
            /* ── Sign-up form ── */
            <>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#f0f0ff",
                    margin: "0 0 6px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  Create your account
                </h1>
                <p style={{ color: "rgba(240,240,255,0.5)", fontSize: "14px", margin: 0 }}>
                  Start tailoring resumes with AI — free forever
                </p>
              </div>

              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "11px 16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  color: "#f0f0ff",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: googleLoading ? "not-allowed" : "pointer",
                  transition: "background 0.2s, border-color 0.2s",
                  opacity: googleLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"
                }}
              >
                {googleLoading ? (
                  <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                ) : (
                  <svg style={{ width: "18px", height: "18px" }} viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: "12px", color: "rgba(240,240,255,0.35)", fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <AlertCircle
                    style={{ width: "14px", height: "14px", color: "#f87171", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: "13px", color: "#f87171" }}>{error}</span>
                </div>
              )}

              <form
                onSubmit={handleSignup}
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "rgba(240,240,255,0.6)",
                      marginBottom: "6px",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={inputStyle}
                    onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "#6c63ff")}
                    onBlur={(e) =>
                      ((e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.12)")
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "rgba(240,240,255,0.6)",
                      marginBottom: "6px",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    style={inputStyle}
                    onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "#6c63ff")}
                    onBlur={(e) =>
                      ((e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.12)")
                    }
                  />
                  <p style={{ fontSize: "11px", color: "rgba(240,240,255,0.35)", marginTop: "5px" }}>
                    Minimum 8 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: loading
                      ? "rgba(108,99,255,0.4)"
                      : "linear-gradient(135deg, #6c63ff, #a78bfa)",
                    border: "none",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "opacity 0.2s",
                    boxShadow: loading ? "none" : "0 4px 20px rgba(108,99,255,0.35)",
                    marginTop: "4px",
                  }}
                >
                  {loading && (
                    <Loader2
                      style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }}
                    />
                  )}
                  {loading ? "Creating account..." : "Get started free"}
                </button>
              </form>

              <p
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: "rgba(240,240,255,0.45)",
                  marginTop: "20px",
                  marginBottom: 0,
                }}
              >
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  style={{ color: "#a78bfa", fontWeight: 600, textDecoration: "none" }}
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "12px",
            color: "rgba(240,240,255,0.25)",
          }}
        >
          By signing up you agree to our{" "}
          <Link href="/" style={{ color: "rgba(240,240,255,0.4)", textDecoration: "none" }}>
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link href="/" style={{ color: "rgba(240,240,255,0.4)", textDecoration: "none" }}>
            Privacy Policy
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
