import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  delta: string
  deltaType: "positive" | "negative" | "neutral"
  hint: string
  icon: React.ElementType
}

export function StatCard({ title, value, delta, deltaType, hint, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded-md",
            deltaType === "positive" ? "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400" : 
            deltaType === "negative" ? "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400" : 
            "text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-400"
          )}>
            {delta}
          </span>
          <p className="text-xs text-muted-foreground">
            {hint}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
