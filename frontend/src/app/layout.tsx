import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "Trợ Lý Ảo Người Khiếm Thị",
  description: "Trợ lý AI bằng giọng nói và thị giác dành cho người khiếm thị kết nối qua LiveKit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-black`}>{children}</body>
    </html>
  );
}
