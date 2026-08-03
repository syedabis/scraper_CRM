"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || "Invalid verification code.");
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

        {!pendingVerification ? (
          <>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">Create your account</h1>
            <p className="text-center text-gray-600 mb-8">Join Cognos Sales CRM to start selling smarter</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 pr-12 text-base focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!isLoaded || submitting}
                className="w-full h-12 text-white font-bold rounded-lg bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? "Creating account..." : "Sign up"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">Verify your email</h1>
            <p className="text-center text-gray-600 mb-8">We sent a code to {email}</p>

            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!isLoaded || submitting}
                className="w-full h-12 text-white font-bold rounded-lg bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? "Verifying..." : "Verify"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-gray-600 mt-6">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-green-700 font-medium hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-center text-gray-500 text-sm mt-6">Powered by DataCrumbs</p>
      </div>
    </div>
  );
}
