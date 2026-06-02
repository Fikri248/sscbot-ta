import { Search, Bell, Menu } from "lucide-react"
import { Input } from "@/components/ui/input"

type DashboardHeaderProps = {
  title: string;
  onMenuClick: () => void;
}

export function DashboardHeader({ title, onMenuClick }: DashboardHeaderProps) {
  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">

        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-background"></span>
          </button>
        </div>
      </div>
    </header>
  )
}
