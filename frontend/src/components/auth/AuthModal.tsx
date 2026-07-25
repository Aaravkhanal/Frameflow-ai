import React, { useState, useEffect } from "react";
import {
  Cross2Icon,
  EnvelopeClosedIcon,
  LockClosedIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";
import { FrameFlowLogo } from "../ui/FrameFlowLogo";

export function AuthModal() {
  const { isAuthModalOpen, authModalTab, setAuthModalOpen, login, register } =
    useAuthStore();
  const [tab, setTab] = useState<"login" | "signup" | "forgot">(authModalTab || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(authModalTab || "login");
  }, [authModalTab]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "login") {
        const res = await login(email, password);
        if (!res.ok) {
          toast.error(res.error || "Invalid sign in credentials");
        } else {
          toast.success("Successfully logged in!");
          setAuthModalOpen(false);
        }
      } else if (tab === "signup") {
        const res = await register(email, name, password);
        if (!res.ok) {
          toast.error(res.error || "Registration failed");
        } else {
          toast.success("Account created successfully!");
          setAuthModalOpen(false);
        }
      } else {
        toast.success("Password reset link sent to your email.");
        setTab("login");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Close authentication modal"
        >
          <Cross2Icon className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20 mb-3">
            <FrameFlowLogo size={32} />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            FrameFlow AI
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {tab === "login"
              ? "Welcome back! Sign in to continue generating UI code."
              : tab === "signup"
              ? "Create your account to start building pixel-perfect apps."
              : "Enter your email address to reset your password."}
          </p>
        </div>

        {/* Tab Selection */}
        {tab !== "forgot" && (
          <div className="flex p-1 mb-6 rounded-xl bg-slate-950/60 border border-white/5">
            <button
              onClick={() => setTab("login")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === "login"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab("signup")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === "signup"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name</label>
              <div className="relative">
                <PersonIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
            <div className="relative">
              <EnvelopeClosedIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          {tab !== "forgot" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">Password</label>
                {tab === "login" && (
                  <button
                    type="button"
                    onClick={() => setTab("forgot")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <LockClosedIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 font-semibold text-sm rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : tab === "login"
              ? "Sign In to FrameFlow AI"
              : tab === "signup"
              ? "Create Free Account"
              : "Send Reset Link"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
