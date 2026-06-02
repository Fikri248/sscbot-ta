import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

type LoginProps = {
  onLogin: (username: string, role: string) => void;
  onShowRegister: () => void;
};

function Login({ onLogin, onShowRegister }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const savedUsername = localStorage.getItem("registeredUsername");
    const savedPassword = localStorage.getItem("registeredPassword");

    const isDefaultAdmin = username === "admin" && password === "admin123";
    const isRegisteredUser =
      username === savedUsername && password === savedPassword;

    if (isDefaultAdmin) {
      localStorage.setItem("isLogin", "true");
      localStorage.setItem("username", username);
      localStorage.setItem("role", "admin");
      onLogin(username, "admin");
    } else if (isRegisteredUser) {
      localStorage.setItem("isLogin", "true");
      localStorage.setItem("username", username);
      localStorage.setItem("role", "user");
      onLogin(username, "user");
    } else {
      alert("Username atau password salah!");
    }
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
            Masukkan username dan password Anda untuk masuk
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">
              Login
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Belum punya akun?{" "}
              <button 
                type="button" 
                onClick={onShowRegister}
                className="text-primary hover:underline font-medium"
              >
                Register
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default Login;