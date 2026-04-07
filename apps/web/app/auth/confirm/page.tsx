"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Zap } from "lucide-react"

/**
 * Client-side auth confirmation page.
 * Handles hash-fragment based auth (e.g., #access_token=...) that
 * server-side route handlers cannot see.
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState("Completing sign-in...")
  const [error, setError] = useState("")

  useEffect(() => {
    const supabase = createClient()

    // The Supabase client auto-detects hash fragments and exchanges them
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(error.message)
        setStatus("Sign-in failed")
        return
      }
      if (data.session) {
        setStatus("Success! Redirecting...")
        router.push("/dashboard")
        router.refresh()
      } else {
        setError("No session found. Try signing in again.")
        setStatus("Sign-in failed")
      }
    })
  }, [router])

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a14", fontFamily: "-apple-system, sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "14px",
          background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <Zap style={{ width: "24px", height: "24px", color: "#fff" }} />
        </div>
        {!error ? (
          <>
            <Loader2 style={{ width: "24px", height: "24px", color: "#a78bfa", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "#f0f0ff", fontSize: "14px" }}>{status}</p>
          </>
        ) : (
          <>
            <p style={{ color: "#f87171", fontSize: "14px", marginBottom: "12px" }}>{error}</p>
            <a href="/auth/login" style={{ color: "#a78bfa", fontSize: "14px", textDecoration: "none" }}>
              Back to sign in
            </a>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
