"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, CATEGORIES, PAYMENT_METHODS } from "@/lib/db";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function BentoDashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
  const [allocationNameInput, setAllocationNameInput] = useState("");
  const [allocationAmountInput, setAllocationAmountInput] = useState("");

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
      await db.expenses.clear();
      setIsResetModalOpen(false);
    } catch (error) {
      console.error("Failed to reset expenses", error);
      alert("Gagal mereset data pengeluaran");
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

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans text-slate-900 p-6 flex flex-col max-w-6xl mx-auto">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            CatatanSaku <span className="text-blue-600">Dashboard</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Selamat pagi, kelola keuanganmu hari ini.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="text-right mr-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Total Pengeluaran
            </p>
            <p className="text-xl font-bold text-slate-800">
              {formatRupiah(totalExpenses)}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 hidden sm:block">
                {userEmail}
              </span>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm">
                <span className="font-bold text-blue-600">
                  {userEmail ? userEmail.substring(0, 2).toUpperCase() : "U"}
                </span>
              </div>
            </div>
            <div className="flex gap-4 mt-1 mr-1">
              <button 
                onClick={() => setIsResetModalOpen(true)}
                className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-700 transition-colors"
              >
                Reset Pengeluaran
              </button>
              <button 
                onClick={handleLogout}
                className="text-[10px] uppercase font-bold text-red-500 hover:text-red-700 transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 flex-1">
        {/* Monthly Budget Card & Allocations */}
        <div className="col-span-1 md:col-span-4 md:row-span-3 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-slate-700">Anggaran Bulanan</h3>
              <button
                onClick={() => {
                  setBudgetInput(budget.toString());
                  setIsBudgetModalOpen(true);
                }}
                className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1.5 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                title="Atur Anggaran Bulanan"
              >
                <span>{monthName.toUpperCase()}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-end mb-2">
                <p className="text-3xl font-bold text-slate-800">
                  {Math.round(progressPercentage)}%
                </p>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sisa Anggaran</p>
                  <p className="text-xs text-slate-500">
                    {formatRupiah(remainingBudget)} / {formatRupiah(budget)}
                  </p>
                </div>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
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
          
          <div className="flex-1 overflow-hidden flex flex-col mt-2 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Alokasi Dana (Tabungan, dll)</h4>
              <button 
                onClick={() => {
                  setAllocationNameInput("");
                  setAllocationAmountInput("");
                  setIsAllocationModalOpen(true);
                }}
                className="text-white bg-slate-800 hover:bg-slate-700 w-6 h-6 rounded flex items-center justify-center font-bold pb-0.5"
              >
                +
              </button>
            </div>
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-2">
              {allocationsData?.map((alloc) => (
                <div key={alloc.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                  <span className="text-xs font-bold text-slate-700">{alloc.name}</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-medium text-indigo-600">{formatRupiah(alloc.amount)}</span>
                    <button 
                      onClick={() => { if(alloc.id) db.allocations.delete(alloc.id) }} 
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {allocationsData?.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-2">Belum ada alokasi dana.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Transaction */}
        <div className="col-span-1 md:col-span-5 md:row-span-2 bg-slate-900 rounded-3xl p-6 shadow-xl flex flex-col justify-between text-white">
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
        <div className="col-span-1 md:col-span-3 md:row-span-6 bg-blue-50 rounded-3xl p-6 border border-blue-100 flex flex-col justify-center text-center">
          <div className="bg-white/50 w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          </div>
          <h3 className="font-bold text-blue-900 mb-2 text-lg">Unduh Laporan PDF</h3>
          <p className="text-[12px] text-blue-700 mb-8 max-w-[200px] mx-auto">
            Simpan data keuangan bulan ini dalam format PDF untuk arsipmu.
          </p>

          <button
            onClick={generatePDFReport}
            disabled={!expenses?.length}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-500 hover:shadow-xl transition-all disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-lg"
          >
            Unduh PDF Sekarang
          </button>
        </div>

        {/* Transaction History */}
        <div className="col-span-1 md:col-span-5 md:row-span-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700">Transaksi Terakhir</h3>
          </div>
          <div className="space-y-1 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {expenses
              ?.sort((a, b) => b.date.getTime() - a.date.getTime())
              .slice(0, 8)
              .map((expense) => {
                const category = CATEGORIES.find(
                  (c) => c.id === expense.categoryId
                );
                return (
                  <div
                    key={expense.id}
                    className="flex items-center p-3 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mr-4 text-white font-bold text-xs"
                      style={{ backgroundColor: category?.color || "#3b82f6" }}
                    >
                      {category?.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">
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
                      <p className="text-sm font-bold text-rose-500">
                        {formatRupiah(expense.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {format(expense.date, "dd MMM, HH:mm")}
                      </p>
                    </div>
                    <div
                      className="ml-4 text-slate-300 hover:text-red-500 cursor-pointer"
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
                    </div>
                  </div>
                );
              })}

            {expenses?.length === 0 && (
              <p className="text-slate-400 text-center py-6 text-sm">
                Belum ada transaksi.
              </p>
            )}
          </div>
        </div>

        {/* Category breakdown (Custom Visual) */}
        <div className="col-span-1 md:col-span-4 md:row-span-3 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <h3 className="font-bold text-slate-700 mb-6">Distribusi Kategori</h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {CATEGORIES.map((category) => {
              const catTotal =
                expenses
                  ?.filter((e) => e.categoryId === category.id)
                  .reduce((acc, e) => acc + e.amount, 0) || 0;
              const catPct =
                totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;

              return (
                <div 
                  key={category.id} 
                  className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-xl transition-colors"
                  onClick={() => setSelectedCategoryDetail(category.id)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm"
                    style={{ backgroundColor: category.color }}
                  >
                    {Math.round(catPct)}%
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700">
                        {category.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {formatRupiah(catTotal)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Atur Anggaran Bulanan</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah (Rp)</label>
                <input 
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0"
                />
                {budgetSuggestions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {budgetSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setBudgetInput(s.value)}
                        className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-md font-bold transition-colors"
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
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 font-bold transition-colors text-sm"
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

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-800 text-lg mb-2">Reset Pengeluaran</h3>
            <p className="text-slate-500 text-sm mb-6">Apakah kamu yakin ingin menghapus SEMUA data pengeluaran? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 font-bold transition-colors text-sm"
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
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Tambah Alokasi Dana</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama (cth: Tabungan)</label>
                <input 
                  type="text"
                  value={allocationNameInput}
                  onChange={(e) => setAllocationNameInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nama Alokasi"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah (Rp)</label>
                <input 
                  type="number"
                  value={allocationAmountInput}
                  onChange={(e) => setAllocationAmountInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0"
                />
                {allocationSuggestions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {allocationSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAllocationAmountInput(s.value)}
                        className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-md font-bold transition-colors"
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
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 font-bold transition-colors text-sm"
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
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-lg">
                Detail Kategori: {CATEGORIES.find(c => c.id === selectedCategoryDetail)?.name}
              </h3>
              <button 
                onClick={() => setSelectedCategoryDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {expenses
                ?.filter(e => e.categoryId === selectedCategoryDetail)
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map(expense => (
                  <div key={expense.id} className="flex items-center p-3 bg-slate-50 rounded-2xl">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {expense.note}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                        {format(expense.date, "dd MMM, HH:mm")} • {PAYMENT_METHODS.find(p => p.id === expense.paymentMethodId)?.name}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <p className="text-sm font-bold text-rose-500">
                        {formatRupiah(expense.amount)}
                      </p>
                      <button
                        className="text-slate-300 hover:text-red-500 transition-colors"
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
              {expenses?.filter(e => e.categoryId === selectedCategoryDetail).length === 0 && (
                <p className="text-center py-6 text-sm text-slate-500">Belum ada transaksi di kategori ini.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
