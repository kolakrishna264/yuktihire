"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils/cn"
import {
  LayoutDashboard,
  Briefcase,
  PlusCircle,
  FileText,
  Wand2,
  Chrome,
  MessageSquare,
  User,
  Settings,
  Zap,
  ChevronRight,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "My Jobs", icon: Briefcase },
  { href: "/dashboard/add-job", label: "Add Job", icon: PlusCircle },
  { href: "/dashboard/tailor", label: "Tailor Resume", icon: Wand2, highlight: true },
  { href: "/dashboard/answers", label: "AI Answers", icon: MessageSquare },
  { href: "/dashboard/resumes", label: "My Resumes", icon: FileText },
  { href: "/dashboard/extension", label: "Get Extension", icon: Chrome },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings/billing", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const avatarLetter = userEmail ? userEmail[0].toUpperCase() : "?"

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-[15px] tracking-tight">YuktiHire</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                "hover:bg-accent hover:text-accent-foreground",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                  active ? "text-primary" : ""
                )}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight className="w-3 h-3 opacity-50" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade CTA */}
      <div className="px-3 pb-3">
        <div className="rounded-xl bg-gradient-to-br from-brand-500/10 to-brand-700/10 border border-brand-200/40 dark:border-brand-500/20 p-3">
          <p className="text-xs font-semibold text-foreground mb-1">Upgrade to Pro</p>
          <p className="text-[11px] text-muted-foreground mb-2.5">
            Unlimited tailoring, exports &amp; ATS scans
          </p>
          <Link
            href="/dashboard/settings/billing"
            className="block text-center text-xs font-semibold py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Upgrade — $19/mo
          </Link>
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{avatarLetter}</span>
          </div>

          {/* Email */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {userEmail ?? "Loading..."}
            </p>
            <p className="text-[10px] text-muted-foreground">Free plan</p>
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            className={cn(
              "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all shrink-0",
              signingOut && "opacity-50 cursor-not-allowed"
            )}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
