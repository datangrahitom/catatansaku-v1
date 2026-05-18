"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (localStorage.getItem("userEmail")) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      alert("Masukkan email yang valid");
      return;
    }
    
    // Karena Anda menolak Firebase, ini adalah simulasi login 
    // yang menyimpan sesi secara lokal di browser.
    localStorage.setItem("userEmail", email);
    router.push("/");
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            CatatanSaku
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Masuk untuk mengelola keuanganmu
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 font-bold transition-colors shadow-sm"
          >
            Masuk
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            *Ini adalah simulasi login lokal karena database diabaikan.
          </p>
        </div>
      </div>
    </div>
  );
}
