import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck } from "lucide-react";

type LoginAdminProps = {
  onLogin: (username: string, role: string) => void;
  onBack: () => void;
};

function LoginAdmin({ onLogin, onBack }: LoginAdminProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const isDefaultAdmin = username === "admin" && password === "admin123";

    if (isDefaultAdmin) {
      localStorage.setItem("isLogin", "true");
      localStorage.setItem("username", username);
      localStorage.setItem("role", "admin");
      onLogin(username, "admin");
    } else {
      alert("Kredensial Admin tidak valid!");
    }
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/img/bg-login.jpg')" }}
    >
      <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-sm" />
      <Card className="w-full max-w-md shadow-2xl border-blue-200 relative z-10 bg-background/95 backdrop-blur-sm">
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <CardHeader className="space-y-1 mt-4">
          <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-blue-700 tracking-tight text-center mb-2">
            Portal Admin SSC
          </CardTitle>
          <CardDescription className="text-center">
            Login menggunakan kredensial staf administrasi SSC
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Admin Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="focus-visible:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus-visible:ring-blue-500"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Login sebagai Admin
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default LoginAdmin;
