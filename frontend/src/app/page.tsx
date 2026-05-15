"use client";

import { useState, useEffect } from "react";
import LiveKitRoomWrapper from "@/components/LiveKitRoomWrapper";

export default function Home() {
  const [connect, setConnect] = useState(false);
  const [username, setUsername] = useState<string>("");
  const roomName = "accessibility_hub"; 

  useEffect(() => {
    let storedUser = localStorage.getItem("accessibility_username");
    if (!storedUser) {
      storedUser = `User_${Math.floor(Math.random() * 100000)}`;
      localStorage.setItem("accessibility_username", storedUser);
    }
    setUsername(storedUser);
  }, []);

  // Hàm xử lý khi người dùng nhấn nút Bắt đầu
  const handleStartConnection = () => {
    // Kích hoạt yêu cầu quyền truy cập vị trí ngay khi click
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          // Lưu vào localStorage để các component con hoặc Agent có thể truy cập
          localStorage.setItem("user_coords", JSON.stringify(coords));
          console.log("📍 Đã xác định vị trí chính xác:", coords);
        },
        (error) => {
          console.warn("⚠️ Không thể lấy vị trí chính xác:", error.message);
          // Vẫn cho phép tiếp tục, Backend sẽ dùng fallback IP nếu cần
        },
        { 
          enableHighAccuracy: true, // Ép dùng GPS/WiFi để có độ chính xác cao nhất
          timeout: 20000,            // Tăng lên 20 giây
          maximumAge: 60000          // Cho phép dùng dữ liệu cũ trong vòng 1 phút
        }
      );
    }

    // Chuyển trạng thái để render LiveKitRoomWrapper (kích hoạt quyền Cam/Mic)
    setConnect(true);
  };

  if (!username) return null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-8 bg-[#050505] text-white overflow-hidden selection:bg-yellow-400 selection:text-black">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0vw,transparent_50vw)]" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

      {connect ? (
        <div className="absolute inset-0 z-10 w-full h-full transform transition-all duration-1000 ease-out translate-y-0 opacity-100">
          <LiveKitRoomWrapper roomName={roomName} username={username} />
        </div>
      ) : (
        <div className="z-10 flex flex-col items-center justify-center max-w-4xl w-full transform transition-all duration-700 ease-in translate-y-0 opacity-100 min-h-screen">
          <h1 className="text-5xl md:text-7xl font-extrabold mb-8 text-center leading-tight tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent drop-shadow-sm">
            Trợ Lý AI <br /> Người Khiếm Thị
          </h1>

          <div className="flex-1 flex flex-col items-center justify-center w-full my-auto">
            <button
              onClick={handleStartConnection}
              aria-label="Nhấn hai lần vào đây để cấp quyền truy cập vị trí và kết nối với Trợ lý"
              className="group relative flex items-center justify-center w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(250,204,21,0.3)] hover:shadow-[0_0_80px_rgba(250,204,21,0.5)] transition-all duration-500 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-yellow-400"
            >
              {/* Outer pulsing ring */}
              <div className="absolute inset-[-20px] rounded-full shadow-[0_0_20px_inset_rgba(250,204,21,0.2)] animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              
              {/* Inner core */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/5 flex items-center justify-center shadow-inner group-hover:bg-gradient-to-br group-hover:from-gray-700 group-hover:to-black transition-colors duration-500">
                <span className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white group-hover:text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-colors duration-500 text-center leading-normal">
                  Nhấn Để<br/>Bắt Đầu
                </span>
              </div>
            </button>
          </div>

          <div 
            className="mt-8 mb-8 text-center text-xl md:text-2xl text-gray-300 font-medium max-w-3xl glassmorphism rounded-2xl p-6 border border-white/5 bg-white/5 backdrop-blur-md focus-within:ring-4 focus-within:ring-yellow-400"
            role="doc-subtitle"
            aria-live="polite"
          >
            <p className="leading-relaxed">
              Ứng dụng tối ưu cho trình đọc màn hình. Âm lượng máy nên để ở mức <span className="font-bold text-yellow-400">80%</span> trở lên.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}