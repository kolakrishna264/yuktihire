"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils/cn"
import {
  LayoutDashboard, FileText, Briefcase, Wand2,
  User, Settings, Zap, ChevronRight,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/resumes", label: "Resumes", icon: FileText },
  { href: "/dashboard/tailor", label: "Tailor Resume", icon: Wand2, highlight: true },
  { href: "/dashboard/jobs", label: "Job Tracker", icon: Briefcase },
  { href: "/dashboard/profile", label: "My Profile", icon: User },
  { href: "/dashboard/settings/billing", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-[15px] tracking-tight">ResumeAI</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                "hover:bg-accent hover:text-accent-foreground",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground",
                item.highlight && !active && "text-primary/80"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade CTA for free users */}
      <div className="p-3">
        <div className="rounded-xl bg-gradient-to-br from-brand-500/10 to-brand-700/10 border border-brand-200/40 dark:border-brand-500/20 p-3">
          <p className="text-xs font-semibold text-foreground mb-1">Upgrade to Pro</p>
          <p className="text-[11px] text-muted-foreground mb-2.5">
            Unlimited tailoring, exports & ATS scans
          </p>
          <Link
            href="/dashboard/settings/billing"
            className="block text-center text-xs font-semibold py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Upgrade — $19/mo
          </Link>
        </div>
      </div>
    </aside>
  )
}
