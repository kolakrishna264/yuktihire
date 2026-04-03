"use client"

import { redirect } from "next/navigation"

export default function DiscoverRedirect() {
  redirect("/dashboard/jobs")
}
