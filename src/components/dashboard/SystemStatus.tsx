import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

const services = [
  { name: "Chat API", status: "operational" },
  { name: "Groq Llama 3.1", status: "operational" },
  { name: "Database", status: "operational" },
  { name: "Auth Service", status: "operational" },
  { name: "File Upload", status: "degraded" },
]

export function SystemStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mt-2">
          {services.map((service) => (
            <div key={service.name} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-foreground">{service.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground capitalize">
                  {service.status}
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  {service.status === "operational" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
