"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Shield, Users, BarChart3, Tag, Flag, Clock, Search, ChevronDown } from "lucide-react"
import { toast } from "sonner"

type Tab = "overview" | "users" | "promo" | "features" | "activity" | "audit" | "quality" | "health"

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    apiFetch("/permissions")
      .then((p: any) => setIsAdmin(p?.isAdmin === true))
      .catch(() => setIsAdmin(false))
  }, [])

  if (isAdmin === null) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>
  if (!isAdmin) return (
    <div className="p-8 text-center">
      <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-lg font-bold">Admin Access Required</h2>
      <p className="text-sm text-muted-foreground">This page is only available to platform administrators.</p>
    </div>
  )

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "promo", label: "Promo Codes", icon: Tag },
    { id: "features", label: "Features", icon: Flag },
    { id: "quality", label: "Autofill Quality", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Clock },
    { id: "audit", label: "Audit Log", icon: Shield },
    { id: "health", label: "System Health", icon: BarChart3 },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Badge className="bg-primary/10 text-primary">Admin</Badge>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "promo" && <PromoTab />}
      {tab === "features" && <FeaturesTab />}
      {tab === "quality" && <QualityTab />}
      {tab === "activity" && <ActivityTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "health" && <HealthTab />}
    </div>
  )
}

// ── Overview ──

function OverviewTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch("/admin/stats"),
  })

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-24" />)}</div>

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, color: "text-blue-600" },
    { label: "Active Today", value: stats?.activeToday ?? 0, color: "text-emerald-600" },
    { label: "Active This Week", value: stats?.activeWeek ?? 0, color: "text-emerald-600" },
    { label: "PRO Users", value: stats?.proUsers ?? 0, color: "text-purple-600" },
    { label: "Total Resumes", value: stats?.totalResumes ?? 0, color: "text-indigo-600" },
    { label: "Applications", value: stats?.totalApplications ?? 0, color: "text-blue-600" },
    { label: "Tailoring Sessions", value: stats?.totalTailoringSessions ?? 0, color: "text-violet-600" },
    { label: "Autofill Sessions", value: stats?.autofillSessions ?? 0, color: "text-amber-600" },
    { label: "Fields Filled", value: stats?.autofillFieldsFilled ?? 0, color: "text-emerald-600" },
    { label: "Saved Answers", value: stats?.savedAnswers ?? 0, color: "text-indigo-600" },
    { label: "Active Jobs", value: stats?.totalJobs ?? 0, color: "text-blue-600" },
    { label: "Promo Redemptions", value: stats?.promoRedemptions ?? 0, color: "text-amber-600" },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value.toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Users ──

function UsersTab() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => apiFetch(`/admin/users?search=${search}&page=${page}&limit=20`),
  })

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User updated") },
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9" />
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64" /> : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Plan</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Joined</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.users || []).map((u: any) => (
                <tr key={u.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{u.email}</td>
                  <td className="p-3">{u.fullName || "—"}</td>
                  <td className="p-3">
                    <Badge variant={u.plan === "PRO" ? "default" : "secondary"} className="text-[10px]">
                      {u.plan}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">{u.role || "user"}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">
                    <select className="text-xs border rounded px-2 py-1" defaultValue={u.plan}
                      onChange={(e) => updateUser.mutate({ id: u.id, data: { plan: e.target.value } })}>
                      <option value="FREE">FREE</option>
                      <option value="PROMO">PROMO</option>
                      <option value="PRO">PRO</option>
                      <option value="TEAM">TEAM</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 bg-muted/30 text-xs text-muted-foreground">
            <span>{data?.total ?? 0} users total</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="py-1">Page {page}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Promo Codes ──

function PromoTab() {
  const [code, setCode] = useState("")
  const [plan, setPlan] = useState("PROMO")
  const [maxUses, setMaxUses] = useState("100")
  const qc = useQueryClient()

  const { data: promos, isLoading } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: () => apiFetch("/promo/list"),
  })

  const createPromo = useMutation({
    mutationFn: () => apiFetch("/promo/create", {
      method: "POST", body: JSON.stringify({ code, unlocks_plan: plan, max_uses: parseInt(maxUses) }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promos"] }); toast.success("Promo created"); setCode("") },
    onError: (e: any) => toast.error(e.message),
  })

  const togglePromo = useMutation({
    mutationFn: (id: string) => apiFetch(`/promo/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promos"] }),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Create Promo Code</h3>
          <div className="flex gap-2">
            <Input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-40 font-mono" />
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="border rounded px-2 text-sm">
              <option value="PROMO">PROMO</option>
              <option value="PRO">PRO</option>
            </select>
            <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="w-24" placeholder="Max uses" />
            <Button onClick={() => createPromo.mutate()} disabled={!code} loading={createPromo.isPending}>Create</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <Skeleton className="h-40" /> : (
        <div className="space-y-2">
          {(promos || []).map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center gap-4">
                <span className="font-mono font-bold text-sm">{p.code}</span>
                <Badge variant="secondary">{p.unlocksplan || p.unlocksPlan}</Badge>
                <span className="text-xs text-muted-foreground">{p.usesConsumed}/{p.maxUses} used</span>
                <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                <Button size="sm" variant="outline" onClick={() => togglePromo.mutate(p.id)} className="ml-auto text-xs">
                  {p.isActive ? "Deactivate" : "Activate"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {(!promos || promos.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No promo codes yet</p>}
        </div>
      )}
    </div>
  )
}

// ── Features ──

function FeaturesTab() {
  const qc = useQueryClient()
  const { data: features, isLoading } = useQuery({
    queryKey: ["admin-features"],
    queryFn: () => apiFetch("/admin/features"),
  })

  const toggle = useMutation({
    mutationFn: (f: { name: string; enabled: boolean }) =>
      apiFetch("/admin/features", { method: "PATCH", body: JSON.stringify(f) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-features"] }),
  })

  if (isLoading) return <Skeleton className="h-40" />

  return (
    <div className="space-y-2">
      {(features || []).map((f: any) => (
        <Card key={f.name}>
          <CardContent className="p-3 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            <button onClick={() => toggle.mutate({ name: f.name, enabled: !f.enabled })}
              className={`w-10 h-5 rounded-full transition-colors ${f.enabled ? "bg-emerald-500" : "bg-gray-300"}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Quality ──

function QualityTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-quality"],
    queryFn: () => apiFetch("/admin/autofill-quality"),
  })

  if (isLoading) return <Skeleton className="h-40" />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Avg Readiness</p>
          <p className="text-2xl font-bold text-blue-600">{data?.avgReadiness ?? 0}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Memory Reuse Rate</p>
          <p className="text-2xl font-bold text-emerald-600">{data?.memoryReuseRate ?? 0}%</p>
        </CardContent></Card>
      </div>

      {data?.portalStats?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Portal Performance</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Portal</th>
                  <th className="text-left p-3">Sessions</th>
                  <th className="text-left p-3">Avg Filled</th>
                  <th className="text-left p-3">Avg Failed</th>
                </tr>
              </thead>
              <tbody>
                {data.portalStats.map((p: any) => (
                  <tr key={p.domain} className="border-t">
                    <td className="p-3 font-mono text-xs">{p.domain}</td>
                    <td className="p-3">{p.sessions}</td>
                    <td className="p-3 text-emerald-600">{p.avgFilled}</td>
                    <td className="p-3 text-red-600">{p.avgFailed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.topQuestions?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Most Common Questions</h3>
          <div className="space-y-1">
            {data.topQuestions.map((q: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs p-2 bg-muted/30 rounded">
                <span className="font-mono text-muted-foreground w-8">{q.uses}x</span>
                <span className="flex-1">{q.question}</span>
                <span className="text-muted-foreground">{q.users} users</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Activity ──

function ActivityTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => apiFetch("/admin/activity?days=7"),
  })

  if (isLoading) return <Skeleton className="h-40" />

  return (
    <div className="space-y-1">
      {(data?.activities || []).map((a: any, i: number) => (
        <div key={i} className="flex items-center gap-3 p-3 text-sm border-b">
          <Badge variant="secondary" className="text-[10px] w-16 justify-center">{a.type}</Badge>
          <span className="flex-1">{a.email}</span>
          {a.status && <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>}
          <span className="text-xs text-muted-foreground">
            {a.timestamp ? new Date(a.timestamp).toLocaleString() : ""}
          </span>
        </div>
      ))}
      {(!data?.activities?.length) && <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>}
    </div>
  )
}

// ── Audit Log ──

function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => apiFetch("/admin/audit-log"),
  })

  if (isLoading) return <Skeleton className="h-40" />

  return (
    <div className="space-y-1">
      {(data || []).map((a: any) => (
        <div key={a.id} className="flex items-center gap-3 p-3 text-sm border-b">
          <Badge variant="secondary" className="text-[10px]">{a.action}</Badge>
          <span className="text-xs text-muted-foreground">{a.adminEmail}</span>
          <span className="flex-1 text-xs">{a.details?.slice(0, 60)}</span>
          <span className="text-xs text-muted-foreground">
            {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
          </span>
        </div>
      ))}
      {(!data?.length) && <p className="text-sm text-muted-foreground text-center py-8">No audit entries</p>}
    </div>
  )
}

// ── System Health ──

function HealthTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => apiFetch("/admin/system-health"),
    refetchInterval: 10000,
  })

  if (isLoading) return <Skeleton className="h-40" />

  const queue = data?.queue || {}
  const ai = data?.ai || {}

  return (
    <div className="space-y-6">
      {/* Status indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Redis</p>
          <p className={`text-sm font-bold ${data?.redis === "connected" ? "text-emerald-600" : "text-red-600"}`}>
            {data?.redis === "connected" ? "Connected" : "Unavailable"}
          </p>
          {data?.redisQueueSize !== undefined && <p className="text-xs text-muted-foreground">{data.redisQueueSize} in queue</p>}
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">DB Pool</p>
          <p className="text-sm font-bold text-blue-600">{data?.db?.checkedOut || 0} / {data?.db?.poolSize || 0}</p>
          <p className="text-xs text-muted-foreground">checked out / pool size</p>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">AI Latency (24h)</p>
          <p className="text-sm font-bold text-violet-600">{ai.avgLatencyMs || 0}ms avg</p>
          <p className="text-xs text-muted-foreground">{ai.maxLatencyMs || 0}ms max</p>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">AI Failure Rate</p>
          <p className={`text-sm font-bold ${(ai.failureRate || 0) > 5 ? "text-red-600" : "text-emerald-600"}`}>
            {ai.failureRate || 0}%
          </p>
          <p className="text-xs text-muted-foreground">{ai.failures24h || 0} / {ai.totalCalls24h || 0} calls</p>
        </CardContent></Card>
      </div>

      {/* Queue breakdown */}
      {Object.keys(queue).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Processing Queue</h3>
          <div className="flex gap-3">
            {Object.entries(queue).map(([status, count]: [string, any]) => (
              <Card key={status}><CardContent className="p-3">
                <p className="text-xs text-muted-foreground capitalize">{status}</p>
                <p className="text-lg font-bold">{count}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent errors */}
      {(data?.recentErrors?.length || 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent Failures</h3>
          <div className="space-y-1">
            {data.recentErrors.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-red-50 rounded text-xs">
                <Badge variant="secondary" className="text-[9px]">{e.type}</Badge>
                <span className="flex-1 text-red-700">{e.error}</span>
                <span className="text-muted-foreground">{e.at ? new Date(e.at).toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
