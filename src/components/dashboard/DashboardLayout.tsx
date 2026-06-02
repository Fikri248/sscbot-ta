import { useState } from "react"
import { AppSidebar } from "./AppSidebar"
import { DashboardHeader } from "./DashboardHeader"
import { Overview } from "./Overview"
import { AdminConversations } from "./AdminConversations"

type DashboardLayoutProps = {
  username: string;
  onLogout: () => void;
}

export function DashboardLayout({ username, onLogout }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const getPageTitle = () => {
    switch (activeTab) {
      case "overview": return "Overview"
      case "conversations": return "Conversations"
      case "users": return "User Management"
      case "analytics": return "Analytics"
      case "models": return "AI Models"
      case "moderation": return "Moderation"
      case "settings": return "Settings"
      default: return "Dashboard"
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-20 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 transform lg:relative lg:translate-x-0 transition duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <AppSidebar 
          activeTab={activeTab} 
          onTabChange={(tab) => {
            setActiveTab(tab)
            setIsSidebarOpen(false)
          }} 
          onLogout={onLogout}
          username={username}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader 
          title={getPageTitle()} 
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-auto bg-muted/20 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl h-full">
            {activeTab === "overview" && <Overview />}
            {activeTab === "conversations" && (
              <div className="h-full bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col">
                <AdminConversations />
              </div>
            )}
            {["users", "analytics", "models", "moderation", "settings"].includes(activeTab) && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">Modul Dalam Pengembangan</h2>
                  <p>Halaman {getPageTitle()} akan segera hadir pada update berikutnya.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
