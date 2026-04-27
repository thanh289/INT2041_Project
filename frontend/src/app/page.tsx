"use client";

import { useState } from "react";
import LiveKitRoomWrapper from "@/components/LiveKitRoomWrapper";

export default function Home() {
  const [connect, setConnect] = useState(false);
  const [username] = useState(`User_${Math.floor(Math.random() * 10000)}`);
  const roomName = "accessibility_hub"; 

  if (connect) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-black text-white">
        <LiveKitRoomWrapper roomName={roomName} username={username} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-black text-white">
      <h1 className="text-6xl font-extrabold text-white mb-16 text-center leading-tight">
        Trợ Lý AI <br /> Người Khiếm Thị
      </h1>
      
      <button
        onClick={() => setConnect(true)}
        aria-label="Nhấn hai lần vào đây để kết nối với Trợ lý và bắt đầu sử dụng"
        className="transform transition hover:scale-105 active:scale-95 flex items-center justify-center rounded-[4rem] border-8 text-black shadow-[0_0_80px_rgba(255,255,0,0.6)] focus:outline-none focus:ring-8 focus:ring-white"
        style={{
          width: '95vw',
          maxWidth: '1280px',
          height: '400px',
          backgroundColor: '#facc15', // yellow-400
          borderColor: '#facc15',
          fontSize: 'clamp(4rem, 8vw, 6rem)', // rất to và responsive
          fontWeight: '900',
          textTransform: 'uppercase',
          padding: '2rem'
        }}
      >
        <span className="text-center w-full block">
          Nhấn Để Bắt Đầu
        </span>
      </button>

      <div 
        className="mt-16 text-center text-2xl text-yellow-300 font-bold max-w-4xl opacity-90"
        role="doc-subtitle"
      >
        Ứng dụng tối ưu cho trình đọc màn hình. Âm lượng máy nên để ở mức 80% trở lên.
      </div>
    </main>
  );
}
