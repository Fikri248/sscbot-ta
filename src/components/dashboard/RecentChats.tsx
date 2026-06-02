import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { CheckCheck, Check } from "lucide-react"

const recentChats: any[] = [];

export function RecentChats() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Daftar Riwayat Conversation</CardTitle>
      </CardHeader>
      <CardContent>
        {recentChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
            <p className="text-sm">Belum ada riwayat percakapan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentChats.map((chat) => (
              <div key={chat.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                  {chat.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="text-sm font-semibold truncate text-foreground">{chat.name}</h4>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{chat.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {chat.unread === 0 && (
                      chat.isRead ? <CheckCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" /> : <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <p className={cn("text-xs truncate", chat.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {chat.message}
                    </p>
                  </div>
                </div>
                {chat.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0 mt-1">
                    {chat.unread}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
import { cn } from "@/lib/utils"
