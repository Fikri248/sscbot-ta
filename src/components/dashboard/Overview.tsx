import { StatCard } from "./StatCard"
import { ActivityChart } from "./ActivityChart"
import { RecentChats } from "./RecentChats"
import { TopTopics } from "./TopTopics"
import { SystemStatus } from "./SystemStatus"
import { Users, MessageCircle, MessageSquareText, Zap } from "lucide-react"

export function Overview() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value="1,284" 
          delta="+12.5%" 
          deltaType="positive"
          hint="vs bulan lalu"
          icon={Users}
        />
        <StatCard 
          title="Active Chats Today" 
          value="342" 
          delta="+5.2%" 
          deltaType="positive"
          hint="vs kemarin"
          icon={MessageCircle}
        />
        <StatCard 
          title="Total Messages" 
          value="45,231" 
          delta="+18.1%" 
          deltaType="positive"
          hint="vs bulan lalu"
          icon={MessageSquareText}
        />
        <StatCard 
          title="AI Tokens Used" 
          value="2.4M" 
          delta="-2.1%" 
          deltaType="negative"
          hint="vs bulan lalu"
          icon={Zap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActivityChart />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TopTopics />
            <SystemStatus />
          </div>
        </div>
        <div className="lg:col-span-1">
          <RecentChats />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
        SSC Dashboard Admin Console &middot; Telkom University &copy; 2026
      </div>
    </div>
  )
}
