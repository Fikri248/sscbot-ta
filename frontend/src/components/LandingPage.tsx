import { User, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

type LandingPageProps = {
  onSelect: (mode: "user" | "admin") => void;
};

export default function LandingPage({ onSelect }: LandingPageProps) {
  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/img/bg-login.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-4xl p-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-md">
            Layanan Student Service Center
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mx-auto drop-shadow-sm">
            Selamat datang di portal cerdas SSC Telkom University. Silakan pilih portal masuk Anda.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* User Card */}
          <Card 
            className="group cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 bg-background/95 backdrop-blur overflow-hidden"
            onClick={() => onSelect("user")}
          >
            <div className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <User className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Portal Mahasiswa</h2>
                <p className="text-muted-foreground text-sm">
                  Masuk untuk menggunakan layanan SSC ChatBot, bertanya seputar akademik, tugas akhir, dan lainnya.
                </p>
              </div>
              <div className="pt-4 w-full">
                <span className="inline-block px-6 py-2 rounded-full bg-primary text-white text-sm font-medium group-hover:bg-primary/90 transition-colors">
                  Masuk sebagai Mahasiswa
                </span>
              </div>
            </div>
          </Card>

          {/* Admin Card */}
          <Card 
            className="group cursor-pointer hover:border-blue-600 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-600/20 bg-background/95 backdrop-blur overflow-hidden"
            onClick={() => onSelect("admin")}
          >
            <div className="p-8 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Portal Admin</h2>
                <p className="text-muted-foreground text-sm">
                  Masuk untuk mengelola dokumen Knowledge Base, melihat analitik, dan memantau interaksi chatbot.
                </p>
              </div>
              <div className="pt-4 w-full">
                <span className="inline-block px-6 py-2 rounded-full bg-blue-600 text-white text-sm font-medium group-hover:bg-blue-700 transition-colors">
                  Masuk sebagai Admin
                </span>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="mt-12 text-center text-white/70 text-sm">
          &copy; 2026 Kelompok 4 (IS-06-03). Telkom University Surabaya.
        </div>
      </div>
    </div>
  );
}
