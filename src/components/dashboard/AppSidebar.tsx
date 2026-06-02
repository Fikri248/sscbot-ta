import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  BarChart3, 
  Cpu, 
  ShieldAlert, 
  Settings,
  LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  username: string;
  isCollapsed?: boolean;
}

export function AppSidebar({ activeTab, onTabChange, onLogout, username, isCollapsed }: AppSidebarProps) {
  const workspaceItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "conversations", label: "Conversations", icon: MessageSquare },
    { id: "users", label: "Users", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ]

  const systemItems = [
    { id: "models", label: "AI Models", icon: Cpu },
    { id: "moderation", label: "Moderation", icon: ShieldAlert },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className={cn(
      "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0">
            TU
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight leading-tight">SSC Dashboard</span>
              <span className="text-[10px] text-sidebar-foreground/70 uppercase tracking-wider">Admin Console</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6 scrollbar-hide">
        <div>
          {!isCollapsed && <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Workspace</h3>}
          <div className="space-y-1">
            {workspaceItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  activeTab === item.id 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          {!isCollapsed && <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">System</h3>}
          <div className="space-y-1">
            {systemItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  activeTab === item.id 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/50 text-xs font-medium">
            {username.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{username}</span>
              <span className="text-[10px] text-sidebar-foreground/60 truncate">{username.toLowerCase()}@telkomuniversity.ac.id</span>
            </div>
          )}
          <button 
            onClick={onLogout}
            title="Logout"
            className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-white transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
