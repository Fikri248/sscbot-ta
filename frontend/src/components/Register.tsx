import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AlertModal, type AlertType } from "./AlertModal";

type RegisterProps = {
  onShowLogin: () => void;
  onLogin: (username: string, role: string) => void;
};

function Register({ onShowLogin, onLogin }: RegisterProps) {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi input kosong
    if (!username || !password) {
      showAlert("Validasi Gagal", "Username dan password wajib diisi!", "warning");
      return;
    }

    // Validasi password minimal 6 karakter
    if (password.length < 6) {
      showAlert("Validasi Gagal", "Password minimal 6 karakter!", "warning");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, email: username, password, role: "user" }),
      });
      const data = await response.json();

      if (data.status === "success" || data.status === 201) {
        // Auto-login after register
        try {
          const loginResponse = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, password }),
          });
          const loginData = await loginResponse.json();

          if (loginData.status === "success" && loginData.data.role === "user") {
            showAlert(
              "Registrasi Berhasil", 
              "Akun berhasil dibuat. Silakan lanjutkan ke SSC ChatBot.", 
              "success",
              () => {
                localStorage.setItem("isLogin", "true");
                localStorage.setItem("username", loginData.data.name);
                localStorage.setItem("role", "user");
                localStorage.setItem("token", loginData.token);
                onLogin(loginData.data.name, "user");
              },
              "Lanjutkan"
            );
          } else {
            showAlert("Login Otomatis Gagal", "Registrasi berhasil, tetapi otomatis login gagal. Silakan login manual.", "warning");
            setTimeout(() => onShowLogin(), 1500);
          }
        } catch (loginErr) {
          showAlert("Login Otomatis Gagal", "Registrasi berhasil, tetapi otomatis login gagal. Silakan login manual.", "warning");
          setTimeout(() => onShowLogin(), 1500);
        }
      } else {
        showAlert("Registrasi Gagal", data.message || "Terjadi kesalahan saat pendaftaran.", "error");
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
          onClick={onShowLogin}
          className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          title="Kembali ke Login"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <CardHeader className="space-y-2 mt-6 flex flex-col items-center">
          <img src="/img/logo_transparent.png" alt="SSC Logo" className="w-16 h-16 object-contain mb-2" />
          <CardTitle className="text-2xl font-bold text-gray-900 tracking-tight text-center">
            Daftar Akun SSC
          </CardTitle>
          <CardDescription className="text-center text-gray-500">
            Buat akun baru untuk menggunakan layanan
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
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
                placeholder="Kata Sandi (min. 6 karakter)"
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
              {isLoading ? "Memproses..." : "Daftar"}
            </Button>
            <div className="text-sm text-center text-gray-500 mt-4">
              Sudah punya akun?{" "}
              <button 
                type="button" 
                onClick={onShowLogin}
                className="text-[#B31217] hover:underline font-semibold"
              >
                Masuk
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
        onConfirm={alertState.onConfirm}
        confirmText={alertState.confirmText}
      />
    </div>
  );
}

export default Register;