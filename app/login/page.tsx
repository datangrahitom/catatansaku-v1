"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (localStorage.getItem("userEmail")) {
      router.push("/");
    }
  }, [router]);

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check saved theme or default to light
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

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
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-sans transition-colors duration-200 p-4">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-800">
        <div className="text-center mb-8 relative">
          <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4">
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shadow-sm"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            CatatanSaku
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Masuk untuk mengelola keuanganmu
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-slate-100"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl py-3 font-bold transition-colors shadow-sm"
          >
            Masuk
          </button>
        </form>
        
        <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2">Panduan Login</h4>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-4">
            <li>Gunakan email Anda untuk masuk ke dashboard.</li>
            <li>Data Anda disimpan secara lokal di browser ini.</li>
            <li>Pastikan tidak menghapus data browser agar riwayat tetap ada.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
