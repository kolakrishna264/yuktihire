export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ""
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function formatScore(score: number): string {
  return `${score}%`
}

export function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 70) return "text-amber-600 dark:text-amber-400"
  return "text-red-500 dark:text-red-400"
}

export function scoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500"
  if (score >= 70) return "bg-amber-500"
  return "bg-red-500"
}

export function planLabel(plan: string): string {
  return { FREE: "Free", PRO: "Pro", PRO_ANNUAL: "Pro Annual", TEAM: "Team" }[plan] ?? plan
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str
}
