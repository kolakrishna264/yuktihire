"use client"

import { useUsage } from "@/lib/hooks/useBilling"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Skeleton } from "@/components/ui/Skeleton"
import { Check, Zap, FileText, Wand2, BarChart3, Download, Clock } from "lucide-react"

const PRO_FEATURES = [
  "Unlimited resume tailoring",
  "Unlimited ATS scans",
  "Unlimited exports",
  "DOCX (Word) downloads",
  "Up to 10 resumes",
  "Priority processing",
]

const FREE_FEATURES = [
  "3 tailoring sessions / month",
  "5 ATS scans / month",
  "2 exports / month",
  "PDF downloads only",
  "1 resume",
]

export default function BillingPage() {
  const { data: usage, isLoading } = useUsage()
  const isPro = usage?.plan && usage.plan !== "FREE"

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and usage
        </p>
      </div>

      {/* Coming Soon banner */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 flex items-start gap-4">
        <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Paid plans are coming soon</p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Enjoy full access during the beta — no credit card needed.
            We&apos;ll announce Pro plans before launch.
          </p>
        </div>
      </div>

      {/* Current plan */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">Current Plan</span>
                {isLoading ? (
                  <Skeleton className="h-5 w-12 rounded-full" />
                ) : (
                  <Badge variant={isPro ? "success" : "secondary"}>
                    {isPro ? "Pro" : "Free (Beta)"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                All features unlocked during beta
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage meters */}
      <Card>
        <CardContent className="p-5 space-y-5">
          <p className="font-semibold">This Month&apos;s Usage</p>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : usage ? (
            <div className="space-y-4">
              <UsageMeter icon={Wand2} label="Tailoring Sessions" used={usage.tailoring.used} max={usage.tailoring.max} unlimited={!!isPro} />
              <UsageMeter icon={BarChart3} label="ATS Scans" used={usage.atsScans.used} max={usage.atsScans.max} unlimited={!!isPro} />
              <UsageMeter icon={Download} label="Exports" used={usage.exports.used} max={usage.exports.max} unlimited={!!isPro} />
              <UsageMeter icon={FileText} label="Resumes (max)" used={0} max={usage.resumesMax} unlimited={false} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Connect to API to see usage stats</p>
          )}

          {usage?.periodEnd && (
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Usage resets on{" "}
              {new Date(usage.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-2 border-primary">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-lg">Free (Beta)</p>
              <Badge variant="success">Current</Badge>
            </div>
            <p className="text-2xl font-bold mb-4">$0</p>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-2 border-border opacity-80">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-lg">Pro</p>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <p className="text-2xl font-bold mb-4">
              $19{" "}
              <span className="text-sm font-normal text-muted-foreground">/ month</span>
            </p>
            <ul className="space-y-2 mb-5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>
              <Clock className="w-4 h-4" />
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function UsageMeter({ icon: Icon, label, used, max, unlimited }: {
  icon: typeof Wand2; label: string; used: number; max: number; unlimited: boolean
}) {
  const pct = unlimited ? 0 : max > 0 ? Math.min((used / max) * 100, 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {unlimited ? "Unlimited" : `${used} / ${max}`}
        </span>
      </div>
      {!unlimited && <Progress value={pct} barClassName={pct >= 80 ? "bg-amber-500" : "bg-primary"} className="h-1.5" />}
    </div>
  )
}
