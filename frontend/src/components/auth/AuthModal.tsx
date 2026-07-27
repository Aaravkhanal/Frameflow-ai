import React, { useState, useEffect } from "react";
import {
  Cross2Icon,
  EnvelopeClosedIcon,
  LockClosedIcon,
} from "@radix-ui/react-icons";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";
import { FrameFlowLogo } from "../ui/FrameFlowLogo";

export function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, sendOtp, verifyOtp } = useAuthStore();
  
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!isAuthModalOpen) {
      setStep("email");
      setOtp("");
      setCountdown(0);
    }
  }, [isAuthModalOpen]);

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => window.clearInterval(timer);
  }, [countdown]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const res = await sendOtp(email);
    setLoading(false);
    
    if (!res.ok) {
      toast.error(res.error || "Failed to send code");
    } else {
      toast.success("Verification code sent!");
      setStep("otp");
      setCountdown(60);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    const res = await verifyOtp(email, otp);
    setLoading(false);

    if (!res.ok) {
      toast.error(res.error || "Invalid verification code");
    } else {
      toast.success("Successfully logged in!");
      setAuthModalOpen(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    const res = await sendOtp(email);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Failed to resend code");
    } else {
      toast.success("Verification code resent!");
      setCountdown(60);
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
            {step === "email"
              ? "Sign in or create an account to continue."
              : `We sent a code to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 mt-2 font-semibold text-sm rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Continue with Email"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Verification Code</label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.toUpperCase())}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-white/10 rounded-xl text-center tracking-widest text-lg font-mono text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3 mt-2 font-semibold text-sm rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                className="text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : "Didn't receive a code? Resend"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
