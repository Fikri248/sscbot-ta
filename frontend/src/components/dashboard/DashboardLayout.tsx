import { useState, useEffect } from "react"
import { AppSidebar } from "./AppSidebar"
import { DashboardHeader } from "./DashboardHeader"
import { Overview } from "./Overview"

import { KnowledgeBase } from "./KnowledgeBase"
import { ChunksViewer } from "./ChunksViewer"
import { ScrapedDataViewer } from "./ScrapedDataViewer"
import { QueryTester } from "./QueryTester"
import { Loader2 } from "lucide-react"

type DashboardLayoutProps = {
  username: string;
  onLogout: () => void;
}

export function DashboardLayout({ username, onLogout }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isBuffering, setIsBuffering] = useState(true)

  useEffect(() => {
    document.title = "Dashboard SSC";
    const timer = setTimeout(() => {
      setIsBuffering(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const getPageTitle = () => {
    switch (activeTab) {
      case "overview": return "Overview"
      case "documents": return "Documents"
      case "chunks": return "Chunks Viewer"
      case "scraped-data": return "Scraped Data"
      case "query-tester": return "RAG Query Tester"
      case "sync": return "Sync & Maintenance"
      default: return "Dashboard"
    }
  }

  if (isBuffering) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Memuat Dashboard SSC...</p>
        </div>
      </div>
    )
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
            {activeTab === "documents" && (
              <div className="h-full">
                <KnowledgeBase />
              </div>
            )}
            {activeTab === "chunks" && (
              <div className="h-full">
                <ChunksViewer />
              </div>
            )}
            {activeTab === "scraped-data" && (
              <div className="h-full">
                <ScrapedDataViewer />
              </div>
            )}
            {activeTab === "query-tester" && (
              <div className="h-full">
                <QueryTester />
              </div>
            )}
            {["sync"].includes(activeTab) && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sync & Maintenance</h2>
                  <p>Fitur sinkronisasi saat ini tersedia melalui tombol di bagian Documents.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
