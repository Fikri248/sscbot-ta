import { useState } from "react";
import Login from "./components/Login";
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

  return <Chatbot onLogout={handleLogout} />;
}

export default App;
