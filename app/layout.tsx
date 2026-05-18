import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CatatanSaku",
  description: "Financial Tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen text-slate-900">{children}</body>
    </html>
  );
}
