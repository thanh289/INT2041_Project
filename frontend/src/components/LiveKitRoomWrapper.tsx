"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import AccessibleControls from "./AccessibleControls";

export default function LiveKitRoomWrapper({
  roomName,
  username,
}: {
  roomName: string;
  username: string;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      try {
        const resp = await fetch(
          `/api/livekit/token?room=${roomName}&username=${username}`
        );
        const data = await resp.json();
        if (isMounted && data.token) {
          setToken(data.token);
        }
      } catch (e) {
        console.error("Lỗi khi lấy token:", e);
      }
    };
    fetchToken();
    return () => {
      isMounted = false;
    };
  }, [roomName, username]);

  if (!token) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen text-4xl text-yellow-400 font-bold"
        aria-live="polite"
      >
        Đang cấu hình hệ thống, vui lòng chờ...
      </div>
    );
  }

  // Kết nối với server LiveKit
  return (
    <LiveKitRoom
      video={false} // Khởi đầu không mở video để tránh tải nặng, người dùng gọi tool mới mở
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      className="h-screen w-full font-sans"
      onConnected={() => {
        // Có thể phát tiếng 'bíp' khi kết nối thành công
        console.log("Đã kết nối vào phòng!");
      }}
    >
      <RoomAudioRenderer />
      
      {/* Component điều khiển chính dành cho người khiếm thị */}
      <AccessibleControls />
    </LiveKitRoom>
  );
}
