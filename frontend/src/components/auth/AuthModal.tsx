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
  const { isAuthModalOpen, setAuthModalOpen, authModalTab, login, register } = useAuthStore();
  
  const [step, setStep] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthModalOpen) {
      setStep(authModalTab === "signup" ? "signup" : "login");
      setEmail("");
      setPassword("");
      setName("");
    }
  }, [isAuthModalOpen, authModalTab]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (step === "signup" && !name)) return;
    
    setLoading(true);
    let res;
    if (step === "login") {
      res = await login(email, password);
    } else {
      res = await register(email, name, password);
    }
    setLoading(false);

    if (!res.ok) {
      toast.error(res.error || "Authentication failed");
    } else {
      toast.success(step === "login" ? "Successfully logged in!" : "Account created!");
      setAuthModalOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Close authentication modal"
        >
          <Cross2Icon className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20 mb-3">
            <FrameFlowLogo size={32} />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            FrameFlow AI
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {step === "login" ? "Sign in to continue." : "Create an account to continue."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === "signup" && (
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

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password || (step === "signup" && !name)}
            className="w-full py-3 mt-2 font-semibold text-sm rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? "Please wait..." : step === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-400">
          {step === "login" ? (
            <p>
              Don't have an account?{" "}
              <button
                onClick={() => setStep("signup")}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => setStep("login")}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
