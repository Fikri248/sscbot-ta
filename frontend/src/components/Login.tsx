import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AlertModal, type AlertType } from "./AlertModal";
import { API_BASE_URL } from "@/services/sscApi";

type LoginProps = {
  onLogin: (username: string, role: string) => void;
  onShowRegister: () => void;
  onBack: () => void;
};

function Login({ onLogin, onShowRegister, onBack }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertState, setAlertState] = useState<{isOpen: boolean, title: string, message: string, type: AlertType}>({
    isOpen: false,
    title: "",
    message: "",
    type: "error"
  });

  const showAlert = (title: string, message: string, type: AlertType) => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });
      const data = await response.json();

      if (data.status === "success" && data.data.role === "user") {
        localStorage.setItem("isLogin", "true");
        localStorage.setItem("username", data.data.name);
        localStorage.setItem("role", "user");
        localStorage.setItem("token", data.token);
        onLogin(data.data.name, "user");
      } else {
        showAlert("Gagal Masuk", data.message || "Email atau password salah!", "error");
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
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <CardHeader className="space-y-2 mt-6 flex flex-col items-center">
          <img src="/img/logo_transparent.png" alt="SSC Logo" className="w-16 h-16 object-contain mb-2" />
          <CardTitle className="text-2xl font-bold text-gray-900 tracking-tight text-center">
            Masuk ke SSC ChatBot
          </CardTitle>
          <CardDescription className="text-center text-gray-500">
            Tanyakan apa saja untuk masalah akademik Anda
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 px-8">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Email atau Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="rounded-xl border-gray-300 focus:ring-[#B31217]"
              />
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Kata Sandi"
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
              {isLoading ? "Memproses..." : "Masuk"}
            </Button>
            <div className="text-sm text-center text-gray-500 mt-4">
              Belum punya akun?{" "}
              <button 
                type="button" 
                onClick={onShowRegister}
                className="text-[#B31217] hover:underline font-semibold"
              >
                Daftar sekarang
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
      
      <AlertModal 
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </div>
  );
}

export default Login;