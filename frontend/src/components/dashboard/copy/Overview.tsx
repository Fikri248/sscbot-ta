import { StatCard } from "./StatCard"
import { ActivityChart } from "./ActivityChart"
import { RecentChats } from "./RecentChats"
import { TopTopics } from "./TopTopics"
import { SystemStatus } from "./SystemStatus"
import { Users, MessageCircle, MessageSquareText, Zap } from "lucide-react"
import { useState, useEffect } from "react"

export function Overview() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeChats: 0,
    totalMessages: 0,
    aiTokensUsed: 0
  });

  useEffect(() => {
    const fetchStats = () => {
      fetch("http://localhost:5000/api/admin/stats")
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            setStats(data.data);
          }
        })
        .catch(err => console.error(err));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers.toString()} 
          delta="Aktif" 
          deltaType="positive"
          icon={Users}
        />
        <StatCard 
          title="Active Chats Today" 
          value={stats.activeChats.toString()} 
          delta="Live" 
          deltaType="positive"
          icon={MessageCircle}
        />
        <StatCard 
          title="Total Messages" 
          value={stats.totalMessages.toString()} 
          delta="Total" 
          deltaType="neutral"
          icon={MessageSquareText}
        />
        <StatCard 
          title="AI Tokens Used" 
          value={stats.aiTokensUsed.toString()} 
          delta="Estimasi" 
          deltaType="neutral"
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
