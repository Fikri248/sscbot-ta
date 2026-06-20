import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AlertModal, type AlertType } from "./AlertModal";

type LoginAdminProps = {
  onLogin: (username: string, role: string) => void;
  onBack: () => void;
};

function LoginAdmin({ onLogin, onBack }: LoginAdminProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertState, setAlertState] = useState<{isOpen: boolean, title: string, message: string, type: AlertType, onConfirm?: () => void, confirmText?: string}>({
    isOpen: false,
    title: "",
    message: "",
    type: "error"
  });

  const showAlert = (title: string, message: string, type: AlertType, onConfirm?: () => void, confirmText?: string) => {
    setAlertState({ isOpen: true, title, message, type, onConfirm, confirmText });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });
      const data = await response.json();

      if (data.status === "success") {
        if (data.data?.role === "admin") {
          showAlert(
            "Login Berhasil",
            "Selamat datang kembali, Admin SSC.",
            "success",
            () => {
              localStorage.setItem("isLogin", "true");
              localStorage.setItem("username", data.data.name);
              localStorage.setItem("role", "admin");
              localStorage.setItem("token", data.token);
              onLogin(data.data.name, "admin");
            },
            "Masuk Dashboard"
          );
        } else {
          showAlert(
            "Login Admin Gagal",
            "Akun ini bukan akun admin. Silakan masuk melalui halaman pengguna.",
            "error"
          );
        }
      } else {
        showAlert("Login Gagal", data.message || "Kredensial Admin tidak valid!", "error");
      }
    } catch (error) {
      showAlert("Kesalahan Sistem", "Terjadi kesalahan saat menghubungi server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen relative p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/img/bg-login.jpg')" }}
    >
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
      <div className="absolute inset-0 bg-black/50" />
      <Card className="w-full max-w-md shadow-2xl border-0 rounded-2xl relative z-10 bg-white">
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <CardHeader className="space-y-2 mt-6 flex flex-col items-center">
          <img src="/img/logo_transparent.png" alt="SSC Logo" className="w-16 h-16 object-contain mb-2" />
          <CardTitle className="text-2xl font-bold text-gray-900 tracking-tight text-center">
            Masuk Admin SSC
          </CardTitle>
          <CardDescription className="text-center text-gray-500">
            Kelola basis pengetahuan dan layanan SSC ChatBot
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 px-8">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Admin Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="rounded-xl border-gray-300 focus:ring-[#B31217]"
              />
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl border-gray-300 focus:ring-[#B31217] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none flex items-center justify-center"
                title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 px-8 pb-8">
            <Button 
              type="submit" 
              className="w-full rounded-xl bg-[#B31217] hover:bg-[#8B0E12] text-white font-medium py-6 transition-all shadow-md" 
              disabled={isLoading}
            >
              {isLoading ? "Memproses..." : "Masuk Dashboard"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <AlertModal 
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onConfirm={alertState.onConfirm}
        confirmText={alertState.confirmText}
      />
    </div>
  );
}

export default LoginAdmin;
