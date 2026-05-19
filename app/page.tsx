"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, CATEGORIES, PAYMENT_METHODS } from "@/lib/db";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BookOpen, RotateCcw, LogOut, PieChart, List, Sun, Moon } from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function BentoDashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [chartType, setChartType] = useState<"list" | "pie">("list");
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

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (!email) {
      router.push("/login");
    } else {
      setUserEmail(email);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    router.push("/login");
  };

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthString = format(currentMonth, "yyyy-MM");
  const monthName = format(currentMonth, "MMMM yyyy");

  // Fetch Data
  const expenses = useLiveQuery(
    () =>
      db.expenses
        .where("date")
        .between(startOfMonth(currentMonth), endOfMonth(currentMonth))
        .toArray(),
    [currentMonth]
  );

  const budgetData = useLiveQuery(() => db.budgets.get(monthString), [
    monthString,
  ]);
  
  const allocationsData = useLiveQuery(
    () => db.allocations.where("month").equals(monthString).toArray(),
    [monthString]
  );

  const budget = budgetData?.amount || 0;
  const totalAllocations = allocationsData?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const totalExpenses =
    expenses?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
  const remainingBudget = Math.max(0, budget - totalAllocations - totalExpenses);
  const progressPercentage =
    budget > 0 ? Math.min(100, ((totalExpenses + totalAllocations) / budget) * 100) : 0;

  // Expense Form State
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [paymentMethodId, setPaymentMethodId] = useState(PAYMENT_METHODS[0].id);
  const [note, setNote] = useState("");

  const getNominalSuggestions = (strVal: string) => {
    const val = parseInt(strVal, 10);
    if (!val || isNaN(val) || val >= 10000) return [];
    
    return [
      { label: (val * 1000).toLocaleString("id-ID"), value: (val * 1000).toString() },
      { label: (val * 10000).toLocaleString("id-ID"), value: (val * 10000).toString() },
      { label: (val * 100000).toLocaleString("id-ID"), value: (val * 100000).toString() },
    ];
  };

  // Modals state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [allocationNameInput, setAllocationNameInput] = useState("");
  const [allocationAmountInput, setAllocationAmountInput] = useState("");

  const [historyStartDate, setHistoryStartDate] = useState<string>("");
  const [historyEndDate, setHistoryEndDate] = useState<string>("");

  const [categoryDetailStartDate, setCategoryDetailStartDate] = useState<string>("");
  const [categoryDetailEndDate, setCategoryDetailEndDate] = useState<string>("");

  const nominalSuggestions = getNominalSuggestions(amount);
  const budgetSuggestions = getNominalSuggestions(budgetInput);
  const allocationSuggestions = getNominalSuggestions(allocationAmountInput);

  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSaveExpense = async () => {
    if (!amount || !categoryId || !paymentMethodId) {
      alert("Harap isi nominal, kategori, dan metode pembayaran!");
      return;
    }

    try {
      await db.expenses.add({
        amount: parseInt(amount.replace(/[^0-9]/g, ""), 10),
        date: new Date(),
        categoryId,
        paymentMethodId,
        note: note || categoryId,
      });
      setAmount("");
      setNote("");
    } catch (error) {
      console.error("Failed to add expense", error);
      alert("Gagal menyimpan pengeluaran");
    }
  };

  const handleSaveBudget = async () => {
    if (!budgetInput) return;
    try {
      await db.budgets.put({
        month: monthString,
        amount: parseInt(budgetInput.replace(/[^0-9]/g, ""), 10) || 0,
      });
      setIsBudgetModalOpen(false);
      setBudgetInput("");
    } catch (error) {
      console.error("Failed to set budget", error);
      alert("Gagal menyimpan anggaran");
    }
  };

  const handleSaveAllocation = async () => {
    if (!allocationNameInput || !allocationAmountInput) return;

    try {
      await db.allocations.add({
        month: monthString,
        name: allocationNameInput,
        amount: parseInt(allocationAmountInput.replace(/[^0-9]/g, ""), 10) || 0,
      });
      setIsAllocationModalOpen(false);
      setAllocationNameInput("");
      setAllocationAmountInput("");
    } catch (error) {
      console.error("Failed to save allocation", error);
      alert("Gagal menyisihkan dana");
    }
  };

  const handleResetData = async () => {
    try {
      await Promise.all([
        db.expenses.clear(),
        db.budgets.clear(),
        db.allocations.clear()
      ]);
      setIsResetModalOpen(false);
    } catch (error) {
      console.error("Failed to reset data", error);
      alert("Gagal mereset data keuangan");
    }
  };

  const generatePDFReport = () => {
    if (!expenses || expenses.length === 0) {
      alert("Tidak ada data pengeluaran untuk diunduh.");
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text(`Laporan Keuangan - ${monthName.toUpperCase()}`, 14, 22);
    
    // Summary Text
    doc.setFontSize(12);
    doc.text(`Anggaran: ${formatRupiah(budget)}`, 14, 32);
    doc.text(`Total Pengeluaran: ${formatRupiah(totalExpenses)}`, 14, 38);
    doc.text(`Sisa Anggaran: ${formatRupiah(remainingBudget)}`, 14, 44);

    // Prepare table data
    const tableColumn = ["Tanggal", "Kategori", "Metode", "Catatan", "Jumlah"];
    const tableRows: any[] = [];

    const sortedExpenses = [...expenses].sort((a, b) => b.date.getTime() - a.date.getTime());
    sortedExpenses.forEach(expense => {
      const expenseData = [
        format(expense.date, "dd MMM yyyy, HH:mm"),
        CATEGORIES.find(c => c.id === expense.categoryId)?.name || expense.categoryId,
        PAYMENT_METHODS.find(p => p.id === expense.paymentMethodId)?.name || expense.paymentMethodId,
        expense.note,
        formatRupiah(expense.amount)
      ];
      tableRows.push(expenseData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [37, 99, 235] } // Tailwind blue-600
    });

    doc.save(`Laporan_CatatanSaku_${monthString}.pdf`);
  };

  const filteredHistoryExpenses = useMemo(() => {
    if (!expenses) return [];
    let result = [...expenses];
    if (historyStartDate) {
      const d = parseISO(historyStartDate);
      d.setHours(0, 0, 0, 0);
      result = result.filter(e => e.date >= d);
    }
    if (historyEndDate) {
      const d = parseISO(historyEndDate);
      d.setHours(23, 59, 59, 999);
      result = result.filter(e => e.date <= d);
    }
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [expenses, historyStartDate, historyEndDate]);

  const filteredCategoryDetailExpenses = useMemo(() => {
    if (!expenses || !selectedCategoryDetail) return [];
    let result = expenses.filter(e => e.categoryId === selectedCategoryDetail);
    if (categoryDetailStartDate) {
      const d = parseISO(categoryDetailStartDate);
      d.setHours(0, 0, 0, 0);
      result = result.filter(e => e.date >= d);
    }
    if (categoryDetailEndDate) {
      const d = parseISO(categoryDetailEndDate);
      d.setHours(23, 59, 59, 999);
      result = result.filter(e => e.date <= d);
    }
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [expenses, selectedCategoryDetail, categoryDetailStartDate, categoryDetailEndDate]);

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 p-4 md:p-8 flex flex-col transition-colors duration-200">
      {/* Header Section */}
      <header className="flex flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            CatatanSaku <span className="text-blue-600 dark:text-blue-400 hidden sm:inline">Dashboard</span>
          </h1>
        </div>
        <div className="flex gap-3 items-center">
          <div className="text-right mr-1 sm:mr-2">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
              Total
            </p>
            <p className="text-sm sm:text-xl font-bold text-slate-800 dark:text-slate-100">
              {formatRupiah(totalExpenses)}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
                {userEmail}
              </span>
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                <span className="font-bold text-blue-600 dark:text-blue-300">
                  {userEmail ? userEmail.substring(0, 2).toUpperCase() : "U"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 sm:gap-4 mt-1 sm:mt-2 mr-1 items-center">
              <button 
                onClick={toggleDarkMode}
                className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                aria-label="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
                <span className="hidden xs:inline">{isDarkMode ? "Terang" : "Gelap"}</span>
              </button>
              <button 
                onClick={() => setIsGuideModalOpen(true)}
                className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1"
                aria-label="Buka Panduan"
              >
                <BookOpen size={12} /> <span className="hidden xs:inline">Panduan</span>
              </button>
              <button 
                onClick={() => setIsResetModalOpen(true)}
                className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center gap-1"
                aria-label="Reset Pengeluaran"
              >
                <RotateCcw size={12} /> <span className="hidden xs:inline">Reset</span>
              </button>
              <button 
                onClick={handleLogout}
                className="text-[9px] sm:text-[10px] uppercase font-bold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex items-center gap-1"
                aria-label="Keluar Aplikasi"
              >
                <LogOut size={12} /> <span className="hidden xs:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 flex-1">
        {/* Monthly Budget Card & Allocations */}
        <div className="col-span-1 md:col-span-4 md:row-span-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-slate-700 dark:text-slate-200">Anggaran Bulanan</h3>
              <button
                onClick={() => {
                  setBudgetInput(budget.toString());
                  setIsBudgetModalOpen(true);
                }}
                className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
                title="Atur Anggaran Bulanan"
                aria-label="Atur Anggaran Bulanan"
              >
                <span>{monthName.toUpperCase()}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-end mb-2">
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {Math.round(progressPercentage)}%
                </p>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Sisa Anggaran</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatRupiah(remainingBudget)} / {formatRupiah(budget)}
                  </p>
                </div>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex" aria-label="Progress Bar Anggaran">
                <div
                  className="h-full bg-indigo-500 transition-all border-r border-white/20"
                  style={{ width: `${budget > 0 ? (totalAllocations / budget) * 100 : 0}%` }}
                  title="Alokasi Dana"
                ></div>
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${budget > 0 ? (totalExpenses / budget) * 100 : 0}%` }}
                  title="Pengeluaran"
                ></div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Alokasi Dana (Tabungan, dll)</h4>
              <button 
                onClick={() => {
                  setAllocationNameInput("");
                  setAllocationAmountInput("");
                  setIsAllocationModalOpen(true);
                }}
                className="text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 w-6 h-6 rounded flex items-center justify-center font-bold pb-0.5 transition-colors"
                aria-label="Tambah Alokasi Dana"
              >
                +
              </button>
            </div>
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-2">
              {allocationsData?.map((alloc) => (
                <div key={alloc.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 group transition-colors">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{alloc.name}</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{formatRupiah(alloc.amount)}</span>
                    <button 
                      onClick={() => { if(alloc.id) db.allocations.delete(alloc.id) }} 
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label={`Hapus Alokasi ${alloc.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {allocationsData?.length === 0 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-2">Belum ada alokasi dana.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Transaction */}
        <div className="col-span-1 md:col-span-5 md:row-span-2 bg-slate-900 dark:bg-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between text-white">
          <h3 className="font-bold text-slate-200 mb-4">Catat Pengeluaran</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                Nominal
              </label>
              <input
                type="number"
                placeholder="Rp 0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-white placeholder-slate-500"
              />
              {nominalSuggestions.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {nominalSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAmount(s.value)}
                      className="text-[10px] bg-slate-800 text-blue-400 hover:bg-slate-700 px-2 py-1 rounded-md font-bold transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                Kategori
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2 text-sm appearance-none outline-none text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-xl px-3 py-2 text-sm appearance-none outline-none text-white"
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSaveExpense}
            className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-sm transition-colors"
          >
            Simpan Catatan
          </button>
        </div>

        {/* PDF Financial Report Section */}
        <div className="col-span-1 md:col-span-3 md:row-span-6 bg-blue-50 dark:bg-slate-900/40 rounded-3xl p-6 border border-blue-100 dark:border-slate-800 flex flex-col justify-center text-center">
          <div className="bg-white/50 dark:bg-slate-800/50 w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100 dark:border-slate-700">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          </div>
          <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-2 text-lg">Unduh Laporan PDF</h3>
          <p className="text-[12px] text-blue-700 dark:text-blue-400 mb-8 max-w-[200px] mx-auto">
            Simpan data keuangan bulan ini dalam format PDF untuk arsipmu.
          </p>

          <button
            onClick={generatePDFReport}
            disabled={!expenses?.length}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-500 hover:shadow-xl transition-all disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-lg focus:ring-4 focus:ring-blue-500/50 outline-none"
            aria-label="Unduh Laporan PDF"
          >
            Unduh PDF Sekarang
          </button>
        </div>

        {/* Transaction History */}
        <div className="col-span-1 md:col-span-5 md:row-span-4 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="flex flex-col xl:flex-row justify-between xl:items-center mb-4 gap-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200">Riwayat Transaksi</h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 text-slate-600 dark:text-slate-300 w-24"
                aria-label="Tanggal Awal"
              />
              <span className="text-[10px] text-slate-400 self-center">-</span>
              <input
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 text-slate-600 dark:text-slate-300 w-24"
                aria-label="Tanggal Akhir"
              />
            </div>
          </div>
          <div className="space-y-1 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {filteredHistoryExpenses
              .map((expense) => {
                const category = CATEGORIES.find(
                  (c) => c.id === expense.categoryId
                );
                return (
                  <div
                    key={expense.id}
                    className="flex items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mr-4 text-white font-bold text-xs shadow-sm"
                      style={{ backgroundColor: category?.color || "#3b82f6" }}
                    >
                      {category?.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {expense.note || category?.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">
                        {category?.name} •{" "}
                        {
                          PAYMENT_METHODS.find(
                            (p) => p.id === expense.paymentMethodId
                          )?.name
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-rose-500 dark:text-rose-400">
                        {formatRupiah(expense.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {format(expense.date, "dd MMM, HH:mm")}
                      </p>
                    </div>
                    <button
                      className="ml-4 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors"
                      aria-label="Hapus Transaksi"
                      onClick={() => {
                         if (expense.id) db.expenses.delete(expense.id);
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  </div>
                );
              })}

            {filteredHistoryExpenses.length === 0 && (
              <p className="text-slate-400 text-center py-6 text-sm">
                Belum ada transaksi sesuai filter.
              </p>
            )}
          </div>
        </div>

        {/* Category breakdown (Custom Visual) */}
        <div className="col-span-1 md:col-span-4 md:row-span-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700 dark:text-slate-200">Distribusi Kategori</h3>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setChartType("list")}
                title="Tampilan Daftar"
                aria-label="Tampilan Daftar"
                className={`p-1.5 rounded-md transition-colors ${chartType === "list" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setChartType("pie")}
                title="Tampilan Diagram"
                aria-label="Tampilan Diagram"
                className={`p-1.5 rounded-md transition-colors ${chartType === "pie" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                <PieChart size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col">
            {chartType === "list" ? (
              CATEGORIES.map((category) => {
                const catTotal =
                  expenses
                    ?.filter((e) => e.categoryId === category.id)
                    .reduce((acc, e) => acc + e.amount, 0) || 0;
                const catPct =
                  totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;

                return (
                  <div 
                    key={category.id} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 -mx-2 rounded-xl transition-colors"
                    onClick={() => setSelectedCategoryDetail(category.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Lihat detail ${category.name}`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ backgroundColor: category.color }}
                    >
                      {Math.round(catPct)}%
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {category.name}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {formatRupiah(catTotal)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${catPct}%`,
                            backgroundColor: category.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 min-h-[220px] flex items-center justify-center">
                {totalExpenses > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={CATEGORIES.map((category) => ({
                          name: category.name,
                          value: expenses?.filter((e) => e.categoryId === category.id).reduce((acc, e) => acc + e.amount, 0) || 0,
                          color: category.color,
                        })).filter((c) => c.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius * 1.2;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill={isDarkMode ? '#94a3b8' : '#64748b'} 
                              textAnchor={x > cx ? 'start' : 'end'} 
                              dominantBaseline="central"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {name} ({(percent * 100).toFixed(0)}%)
                            </text>
                          );
                        }}
                        labelLine={{ stroke: isDarkMode ? '#475569' : '#cbd5e1' }}
                      >
                        {CATEGORIES.map((category, index) => (
                          <Cell key={`cell-${index}`} fill={category.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatRupiah(value)}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px -2px rgb(0 0 0 / 0.1)', backgroundColor: isDarkMode ? '#1e293b' : '#fff' }}
                        itemStyle={{ color: isDarkMode ? '#f8fafc' : '#1e293b', fontWeight: 'bold' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-sm text-center">Belum ada pengeluaran.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Watermark */}
      <footer className="mt-8 mb-4 text-center">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
          Catatan Saku by Datan Grahito 2026
        </p>
      </footer>

      {/* Modals */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-4">Atur Anggaran Bulanan</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah (Rp)</label>
                <input 
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0"
                />
                {budgetSuggestions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {budgetSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setBudgetInput(s.value)}
                        className="text-[10px] bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 px-2 py-1 rounded-md font-bold transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl py-3 font-bold transition-colors text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveBudget}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 font-bold transition-colors text-sm"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGuideModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Panduan Penggunaan</h3>
              <button 
                onClick={() => setIsGuideModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold text-xl"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 text-sm text-slate-600 dark:text-slate-300">
              <div>
                 <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">🚀 Cara Pakai:</h4>
                 <ol className="list-decimal pl-5 space-y-1">
                   <li>Masukkan <strong>Anggaran Bulanan</strong> sebagai batas total pengeluaran dan alokasimu.</li>
                   <li>Tentukan <strong>Alokasi Dana</strong> (opsional) di awal bulan untuk menabung, membayar tagihan rutin, atau berinvestasi.</li>
                   <li>Catat <strong>Pengeluaran</strong> setiap kali kamu melakukan transaksi berdasarkan kategorinya.</li>
                   <li>Pantau grafik <strong>Distribusi Kategori</strong> dan daftar transaksi untuk mengevaluasi keuanganmu.</li>
                   <li>Unduh <strong>Laporan PDF</strong> di akhir bulan sebagai arsip pribadi.</li>
                 </ol>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
                <h4 className="font-bold text-amber-800 dark:text-amber-500 mb-1 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Note Penyimpanan Data
                </h4>
                <p className="text-amber-800 dark:text-amber-400 text-xs mt-1">
                  Semua datamu disimpan <strong>SECARA LOKAL</strong> di dalam browser peramban perangkat ini. Server kami tidak melihat atau menyimpan data keuanganmu, privasimu aman!
                </p>
                <p className="text-amber-800 dark:text-amber-400 text-xs mt-2 font-semibold">
                  ⚠️ PENTING: Jika kamu membersihkan riwayat browser (clear cache/data) atau membuka aplikasi ini dari perangkat/browser lain, datamu tidak akan muncul. Selalu unduh laporan PDF untuk dicadangkan!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-2">Reset Data</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Apakah kamu yakin ingin menghapus SEMUA data (Anggaran, Alokasi, dan Pengeluaran)? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl py-3 font-bold transition-colors text-sm"
              >
                Batal
              </button>
              <button 
                onClick={handleResetData}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-3 font-bold transition-colors text-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {isAllocationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-4">Tambah Alokasi Dana</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama (cth: Tabungan)</label>
                <input 
                  type="text"
                  value={allocationNameInput}
                  onChange={(e) => setAllocationNameInput(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nama Alokasi"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah (Rp)</label>
                <input 
                  type="number"
                  value={allocationAmountInput}
                  onChange={(e) => setAllocationAmountInput(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                   placeholder="0"
                />
                {allocationSuggestions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {allocationSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAllocationAmountInput(s.value)}
                         className="text-[10px] bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 px-2 py-1 rounded-md font-bold transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsAllocationModalOpen(false)}
                   className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl py-3 font-bold transition-colors text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveAllocation}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 font-bold transition-colors text-sm"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCategoryDetail && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">
                Detail Kategori: {CATEGORIES.find(c => c.id === selectedCategoryDetail)?.name}
              </h3>
              <button 
                onClick={() => {
                  setSelectedCategoryDetail(null);
                  setCategoryDetailStartDate("");
                  setCategoryDetailEndDate("");
                }}
                 className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold text-xl"
                 aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2 mb-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
              <input
                type="date"
                value={categoryDetailStartDate}
                onChange={(e) => setCategoryDetailStartDate(e.target.value)}
                 className="flex-1 text-[11px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-slate-600 dark:text-slate-200"
                 aria-label="Tanggal Awal Kategori"
              />
              <span className="text-[11px] text-slate-400 self-center">-</span>
              <input
                type="date"
                value={categoryDetailEndDate}
                onChange={(e) => setCategoryDetailEndDate(e.target.value)}
                className="flex-1 text-[11px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-slate-600 dark:text-slate-200"
                aria-label="Tanggal Akhir Kategori"
              />
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {filteredCategoryDetailExpenses
                .map(expense => (
                  <div key={expense.id} className="flex items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {expense.note}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                        {format(expense.date, "dd MMM, HH:mm")} • {PAYMENT_METHODS.find(p => p.id === expense.paymentMethodId)?.name}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <p className="text-sm font-bold text-rose-500 dark:text-rose-400">
                        {formatRupiah(expense.amount)}
                      </p>
                      <button
                         className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                         aria-label="Hapus Transaksi Kategori"
                        onClick={() => {
                           if (expense.id) db.expenses.delete(expense.id);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              {filteredCategoryDetailExpenses.length === 0 && (
                <p className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">Belum ada transaksi di kategori ini.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
