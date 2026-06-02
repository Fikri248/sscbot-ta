import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

const topics = [
  { name: "Horor", percentage: 85 },
  { name: "Komedi", percentage: 65 },
  { name: "Drama", percentage: 45 },
  { name: "Action", percentage: 35 },
  { name: "Romance", percentage: 20 },
  { name: "Thriller", percentage: 15 },
]

export function TopTopics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Top Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mt-2">
          {topics.map((topic) => (
            <div key={topic.name} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-foreground">{topic.name}</span>
                <span className="text-muted-foreground">{topic.percentage}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${topic.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
