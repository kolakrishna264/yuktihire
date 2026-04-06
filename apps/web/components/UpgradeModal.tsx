"use client"
import { Button } from "@/components/ui/Button"
import { Zap, X, Check, Clock } from "lucide-react"

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
  "Priority support",
]

export function UpgradeModal({ open, onClose, trigger }: UpgradeModalProps) {
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
          <h2 className="text-xl font-bold mb-1">Pro Plan</h2>
          {trigger && (
            <p className="text-sm text-muted-foreground">{trigger}</p>
          )}
        </div>

        {/* Coming Soon banner */}
        <div className="mx-6 mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Coming Soon</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Paid plans are launching soon. Enjoy full access during the beta!</p>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What you'll get with Pro</p>
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
            variant="outline"
            size="lg"
            className="w-full"
            onClick={onClose}
          >
            Got it — Enjoy the Beta
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Free during beta · No credit card needed
          </p>
        </div>
      </div>
    </div>
  )
}
