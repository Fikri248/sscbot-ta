import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import Chatbot from "./components/Chatbot";
import { Button } from "./components/ui/button";
import { LogOut } from "lucide-react";
import "./App.css";

function App() {
  const [isLogin, setIsLogin] = useState(
    localStorage.getItem("isLogin") === "true"
  );

  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );

  const [role, setRole] = useState(
    localStorage.getItem("role") || "user"
  );

  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = (name: string, userRole: string) => {
    setUsername(name);
    setRole(userRole);
    setIsLogin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLogin");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setUsername("");
    setRole("user");
    setIsLogin(false);
  };

  if (!isLogin && showRegister) {
    return <Register onShowLogin={() => setShowRegister(false)} />;
  }

  if (!isLogin) {
    return (
      <Login
        onLogin={handleLogin}
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }

  if (role === "admin") {
    return <DashboardLayout username={username} onLogout={handleLogout} />;
  }

  // Render for standard user
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="p-4 flex items-center justify-between bg-card border-b border-border shadow-sm shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0">
            TU
          </div>
          <span className="font-bold tracking-tight leading-tight">SSC Dashboard</span>
        </div>
        <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center relative p-8 text-center bg-muted/20">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Under Construction</h2>
        <p className="text-muted-foreground max-w-md">
          Halaman untuk mahasiswa (User) belum tersedia. Bagian ini akan dilanjutkan pada tahap pengembangan berikutnya.
        </p>
      </div>
    </div>
  );
}

export default App;