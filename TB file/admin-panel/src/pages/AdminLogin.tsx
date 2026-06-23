import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAdminSession, AdminRole } from "../lib/auth";
import { api, ApiError } from "../lib/api";

type View = "login" | "forgot";

const EyeIcon = ({ show }: { show: boolean }) => show
  ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z"/><path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0115.75 12zM12.53 15.713l-4.243-4.244a3.75 3.75 0 004.243 4.243z"/><path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 00-2.63 4.31c-.12.362-.12.752 0 1.114C2.816 17.223 7.03 20.447 12 20.447c1.525 0 2.973-.338 4.264-.944l-3.1-3.1A3.75 3.75 0 016.75 12z"/></svg>
  : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113C21.186 17.023 16.97 20.25 12 20.25c-4.97 0-9.184-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd"/></svg>;

export default function AdminLogin() {
  const [view, setView] = useState<View>("login");

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const navigate = useNavigate();

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.post<{ access_token: string; role: string }>("/admin/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      setAdminSession(res.data.access_token, res.data.role as AdminRole);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.response.data?.detail || "Login failed");
      } else {
        setError("Network error. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(""); setForgotMsg(""); setForgotLoading(true);
    try {
      const res = await api.post<{ message: string }>("/admin/forgot-password", {
        email: forgotEmail.trim().toLowerCase(),
      });
      setForgotMsg(res.data.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setForgotError(err.response.data?.detail || "Request failed");
      } else {
        setForgotError("Network error. Is the server running?");
      }
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-8 safe-top safe-bottom"
         style={{ background: "linear-gradient(135deg, #071A3E 0%, #0D2657 60%, #1A7BD4 100%)" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="gPawa" className="w-20 h-20 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gpawa-navy">gPawa Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Staff access only</p>
        </div>

        {view === "login" ? (
          <>
            <form onSubmit={onLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gpawa-navy mb-1">Email Address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="staff@gpawa.ug"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gpawa-navy mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600">
                    <EyeIcon show={showPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gpawa-blue text-white font-semibold rounded-lg hover:bg-gpawa-navy disabled:opacity-60 transition-colors">
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="text-center mt-5">
              <button type="button" onClick={() => { setView("forgot"); setForgotMsg(""); setForgotError(""); setForgotEmail(email); }}
                className="text-sm text-gpawa-blue hover:underline">
                Forgot Password?
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-5">
              Enter your email address and your password will be reset to <strong>1234</strong>.
            </p>
            <form onSubmit={onForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gpawa-navy mb-1">Email Address</label>
                <input
                  type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  placeholder="staff@gpawa.ug"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue"
                  required
                />
              </div>

              {forgotError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{forgotError}</div>
              )}
              {forgotMsg && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{forgotMsg}</div>
              )}

              <button type="submit" disabled={forgotLoading}
                className="w-full py-3 bg-gpawa-blue text-white font-semibold rounded-lg disabled:opacity-60 transition-colors">
                {forgotLoading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <button type="button" onClick={() => setView("login")}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gpawa-navy">
              ← Back to Sign In
            </button>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Staff access only · Contact your administrator for credentials
        </p>
      </div>
    </div>
  );
}
