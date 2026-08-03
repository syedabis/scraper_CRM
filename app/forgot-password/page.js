"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";

export default function ForgotPasswordPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("request"); // request | reset
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("reset");
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || "Could not send reset code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
      } else {
        setError("Could not reset password. Please try again.");
      }
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || "Invalid code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-6 lg:p-8 relative overflow-hidden bg-gray-900">
      <img
        src="/images/login-bg.webp"
        alt="Background"
        className="absolute inset-0 h-full w-full object-cover opacity-60"
      />

      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8">
        <div className="flex items-center justify-center mb-3">
          <img src="/logo.png" alt="DataCrumbs" className="h-12 w-auto object-contain" />
        </div>

        {step === "request" ? (
          <>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">Reset password</h1>
            <p className="text-center text-gray-600 mb-8">Enter your email and we&apos;ll send you a reset code</p>

            <form onSubmit={handleRequest} className="space-y-4">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!isLoaded || submitting}
                className="w-full h-12 text-white font-bold rounded-lg bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? "Sending..." : "Send reset code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">Set a new password</h1>
            <p className="text-center text-gray-600 mb-8">Enter the code sent to {email}</p>

            <form onSubmit={handleReset} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Reset code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
              <input
                type="password"
                required
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!isLoaded || submitting}
                className="w-full h-12 text-white font-bold rounded-lg bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? "Resetting..." : "Reset password"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-gray-600 mt-6">
          Remembered your password?{" "}
          <Link href="/sign-in" className="text-green-700 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
