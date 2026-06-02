import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

type RegisterProps = {
  onShowLogin: () => void;
};

function Register({ onShowLogin }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi input kosong
    if (!username || !password) {
      alert("Username dan password wajib diisi!");
      return;
    }

    // Validasi password minimal 6 karakter
    if (password.length < 6) {
      alert("Password minimal 6 karakter!");
      return;
    }

    // Simpan akun ke localStorage
    localStorage.setItem("registeredUsername", username);
    localStorage.setItem("registeredPassword", password);

    alert("Register berhasil! Silakan login.");

    // Kembali ke halaman login
    onShowLogin();
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/img/bg-login.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, hsla(359, 75%, 28%, 0.85) 0%, transparent 35%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to left, hsla(359, 75%, 28%, 0.8) 0%, transparent 25%)' }} />
      <Card className="w-full max-w-md shadow-xl border-muted relative z-10 bg-background/95 backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-primary tracking-tight text-center mb-2">Selamat Datang di Layanan SSC</CardTitle>
          <CardDescription className="text-center">
            Buat akun baru untuk menggunakan layanan
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Buat Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Buat Password (min. 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">
              Register
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Sudah punya akun?{" "}
              <button 
                type="button" 
                onClick={onShowLogin}
                className="text-primary hover:underline font-medium"
              >
                Login
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default Register;