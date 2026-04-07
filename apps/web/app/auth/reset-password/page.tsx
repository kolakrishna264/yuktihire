"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Zap, AlertCircle, Loader2, Lock, CheckCircle } from "lucide-react"
import { toast } from "sonner"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase redirects here with a hash fragment containing the access token
    // The client library auto-exchanges it for a session
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true)
      }
    })
    // Also check if we already have a session (user clicked the link)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true)
    })
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      toast.success("Password updated!")
      setTimeout(() => router.push("/dashboard"), 2000)
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
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a14", padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <Link href="/marketing" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
            }}>
              <Zap style={{ width: "20px", height: "20px", color: "#fff" }} strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: "20px", letterSpacing: "-0.5px", color: "#f0f0ff" }}>
              YuktiHire
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: "#12121f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px",
          padding: "36px 32px", boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.08)",
        }}>
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "16px",
                background: "rgba(34,197,94,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <CheckCircle style={{ width: "28px", height: "28px", color: "#22c55e" }} />
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0ff", margin: "0 0 8px" }}>
                Password updated!
              </h1>
              <p style={{ color: "rgba(240,240,255,0.5)", fontSize: "14px", margin: "0 0 16px" }}>
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "14px",
                  background: "rgba(108,99,255,0.1)", display: "flex",
                  alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                }}>
                  <Lock style={{ width: "24px", height: "24px", color: "#a78bfa" }} />
                </div>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0ff", margin: "0 0 6px" }}>
                  Set new password
                </h1>
                <p style={{ color: "rgba(240,240,255,0.5)", fontSize: "14px", margin: 0 }}>
                  Choose a strong password for your account
                </p>
              </div>

              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 14px", background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", marginBottom: "16px",
                }}>
                  <AlertCircle style={{ width: "14px", height: "14px", color: "#f87171", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "#f87171" }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{
                    display: "block", fontSize: "12px", fontWeight: 600,
                    color: "rgba(240,240,255,0.6)", marginBottom: "6px",
                    letterSpacing: "0.02em", textTransform: "uppercase",
                  }}>New Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters" required minLength={8} style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "#6c63ff")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                </div>
                <div>
                  <label style={{
                    display: "block", fontSize: "12px", fontWeight: 600,
                    color: "rgba(240,240,255,0.6)", marginBottom: "6px",
                    letterSpacing: "0.02em", textTransform: "uppercase",
                  }}>Confirm Password</label>
                  <input
                    type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password" required minLength={8} style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "#6c63ff")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                </div>

                <button type="submit" disabled={loading} style={{
                  width: "100%", padding: "12px 16px",
                  background: loading ? "rgba(108,99,255,0.4)" : "linear-gradient(135deg, #6c63ff, #a78bfa)",
                  border: "none", borderRadius: "10px", color: "#fff", fontSize: "15px", fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(108,99,255,0.35)", marginTop: "4px",
                }}>
                  {loading && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />}
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
