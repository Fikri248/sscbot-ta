import { Bell, Menu, UserPlus, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";

type DashboardHeaderProps = {
  title: string;
  onMenuClick: () => void;
};

type Notification = {
  id: string;
  type: string;
  name: string;
  action: string;
  created_at: string;
};

export function DashboardHeader({ title, onMenuClick }: DashboardHeaderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchNotifications = () => {
      fetch("http://localhost:5000/api/admin/notifications")
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success") {
            setNotifications(data.data);
          }
        })
        .catch((err) => console.error(err));
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const recentCount = notifications.filter(
    (n) => new Date().getTime() - new Date(n.created_at).getTime() < 24 * 60 * 60 * 1000
  ).length;

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
        <div className="flex items-center gap-3 relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative p-2 rounded-full hover:bg-accent text-muted-foreground transition-colors"
          >
            <Bell className="w-5 h-5" />
            {recentCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-background">
                {recentCount}
              </span>
            )}
          </button>
          
          {showDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-2 flex flex-col gap-2 z-50">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-sm">Aktivitas Sistem</h3>
                <p className="text-xs text-muted-foreground">Monitoring pendaftaran & penggunaan</p>
              </div>
              
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1 p-1">
                {notifications.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-4">Tidak ada aktivitas</p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-default">
                    <div className={`p-2 rounded-full ${n.type === 'register' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                      {n.type === 'register' ? <UserPlus className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">
                        <span className="font-bold">{n.name || 'Mahasiswa'}</span> {n.action}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(n.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
