import { useState } from "react";
import Login from "./components/Login";
import LoginAdmin from "./components/LoginAdmin";
import LandingPage from "./components/LandingPage";
import Register from "./components/Register";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import Chatbot from "./components/Chatbot";
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

  const [authPage, setAuthPage] = useState<"landing" | "login_user" | "login_admin" | "register">("landing");

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
    setAuthPage("landing");
  };

  if (!isLogin) {
    if (authPage === "landing") {
      return <LandingPage onSelect={(mode) => setAuthPage(mode === "user" ? "login_user" : "login_admin")} />;
    }
    if (authPage === "register") {
      return <Register onShowLogin={() => setAuthPage("login_user")} />;
    }
    if (authPage === "login_admin") {
      return <LoginAdmin onLogin={handleLogin} onBack={() => setAuthPage("landing")} />;
    }
    return (
      <Login
        onLogin={handleLogin}
        onShowRegister={() => setAuthPage("register")}
        onBack={() => setAuthPage("landing")}
      />
    );
  }

  if (role === "admin") {
    return <DashboardLayout username={username} onLogout={handleLogout} />;
  }

  return <Chatbot onLogout={handleLogout} />;
}

export default App;
