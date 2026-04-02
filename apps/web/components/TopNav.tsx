"use client"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { LogOut, Bell } from "lucide-react"
import type { User } from "@supabase/supabase-js"

interface TopNavProps { user: User }

export function TopNav({ user }: TopNavProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const initials = user.email?.slice(0, 2).toUpperCase() ?? "?"

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1" />
      <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
        <Bell className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-tight">{user.email?.split("@")[0]}</p>
          <p className="text-[11px] text-muted-foreground">{user.email}</p>
        </div>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
