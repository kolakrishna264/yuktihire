"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { useCreateCheckout } from "@/lib/hooks/useBilling"
import { Zap, X, Check } from "lucide-react"

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  trigger?: string
}

const PRO_FEATURES = [
  "Unlimited resume tailoring",
  "Unlimited ATS scans",
  "10 resumes",
  "Unlimited PDF & DOCX exports",
  "Advanced AI rewrites",
  "Unlimited job tracker",
  "Email support",
]

export function UpgradeModal({ open, onClose, trigger }: UpgradeModalProps) {
  const [plan, setPlan] = useState<"PRO" | "PRO_ANNUAL">("PRO")
  const { mutate: checkout, isPending } = useCreateCheckout()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-1">Upgrade to Pro</h2>
          {trigger && (
            <p className="text-sm text-muted-foreground">{trigger}</p>
          )}
        </div>

        {/* Plan toggle */}
        <div className="px-6 mb-4">
          <div className="flex rounded-xl border border-border p-1 gap-1">
            <button
              onClick={() => setPlan("PRO")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                plan === "PRO" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly — $19
            </button>
            <button
              onClick={() => setPlan("PRO_ANNUAL")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                plan === "PRO_ANNUAL" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual — $149
              <span className="ml-1 text-[10px] font-bold text-emerald-500">SAVE 35%</span>
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 mb-5">
          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 pb-6">
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            loading={isPending}
            onClick={() => checkout(plan)}
          >
            <Zap className="w-4 h-4" />
            Start Pro — {plan === "PRO" ? "$19/mo" : "$149/yr"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Cancel anytime · Secure payment via Stripe
          </p>
        </div>
      </div>
    </div>
  )
}
