"use client";

import { useState } from "react";
import Link from "next/link";

export default function SendInvoicePage() {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("amount", amount);
      formData.append("email", email);

      const response = await fetch("/api/generate-receipt", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSuccess(true);
        setName("");
        setAmount("");
        setEmail("");
      } else {
        setError("Failed to generate receipt. Please try again.");
      }
    } catch (err) {
      setError("Failed to reach the invoicing service.");
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
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-900">Send Invoice</h1>
        <p className="text-center text-gray-600 mb-8">Generate and email a course payment receipt</p>

        {success && (
          <p className="text-center text-sm text-green-600 mb-4">Receipt generated and sent successfully!</p>
        )}
        {error && <p className="text-center text-sm text-red-600 mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Student Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="number"
            step="0.01"
            required
            placeholder="Course Fees"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="email"
            required
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex rounded-md border w-full h-12 !bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-white font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {submitting ? "Generating..." : "Generate Receipt"}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          <Link href="/" className="text-indigo-600 font-medium hover:underline">
            Back to Dashboard
          </Link>
        </p>

        <p className="text-center text-gray-500 text-sm mt-6">Powered by DataCrumbs</p>
      </div>
    </div>
  );
}
