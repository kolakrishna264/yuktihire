import { createClient } from "@/lib/supabase/server"
import DashboardShellLazy from "@/components/DashboardShellLazy"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <DashboardShellLazy user={user} />
}
