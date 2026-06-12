import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User } from "lucide-react";
import useAuth from "../hooks/useAuth";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-slate-900">PharmaCare</h1>
        <p className="text-slate-500 mt-2">
          Sign in to manage pharmacy stock and dosette records.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700">Username</label>
            <div className="mt-2 flex items-center gap-3 border border-slate-300 rounded-2xl px-4 py-3">
              <User size={18} className="text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full outline-none"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <div className="mt-2 flex items-center gap-3 border border-slate-300 rounded-2xl px-4 py-3">
              <Lock size={18} className="text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full outline-none"
                placeholder="Enter password"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-2xl px-4 py-3">
              {error}
            </p>
          )}

          <button className="w-full bg-slate-950 text-white py-3 rounded-2xl font-semibold hover:bg-slate-800 transition">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;