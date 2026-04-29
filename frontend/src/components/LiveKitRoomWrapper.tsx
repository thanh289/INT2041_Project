"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRemoteParticipants } from "@livekit/components-react";
import "@livekit/components-styles";
import AccessibleControls from "./AccessibleControls";
import AudioVisualizer from "./AudioVisualizer";

function RoomHeader() {
  const remoteParticipants = useRemoteParticipants();
  const agentParticipant = remoteParticipants.length > 0 ? remoteParticipants[0] : null;

  return (
    <div className="w-full bg-black/40 backdrop-blur-md border-b border-white/5 py-4 px-6 flex items-center justify-center shadow-md z-20">
      <h2 
        className={`text-2xl md:text-3xl font-extrabold tracking-widest drop-shadow-lg transition-colors duration-500 uppercase ${agentParticipant ? 'text-cyan-400' : 'text-gray-400'}`}
        aria-live="polite"
      >
        {agentParticipant ? "ASSISTANT ACTIVE" : "WAITING FOR ASSISTANT..."}
      </h2>
    </div>
  );
}

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
      video={false}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      className="h-screen w-full font-sans flex flex-col bg-[#050505] text-white relative"
      onConnected={() => {
        console.log("Đã kết nối vào phòng!");
        const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...");
        beep.play().catch(e => console.log(e));
      }}
    >
      <RoomAudioRenderer />
      
      {/* Universal Fixed Header */}
      <RoomHeader />

      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-900/10 blur-[100px] rounded-full" />
      </div>

      <div className="flex-1 flex flex-col w-full h-full max-w-6xl mx-auto overflow-hidden z-10 p-2 md:p-6 gap-4">
        {/* Top: Visualizer Area */}
        <div className="h-[25vh] min-h-[150px] w-full relative overflow-hidden rounded-3xl p-6 shadow-[0_0_40px_rgba(34,211,238,0.05)] border border-white/10 bg-white/[0.02] backdrop-blur-xl focus-within:ring-4 focus-within:ring-yellow-400">
          <AudioVisualizer />
        </div>

        {/* Middle/Bottom: Controls */}
        <div className="flex-1 overflow-hidden">
          <AccessibleControls />
        </div>
      </div>
    </LiveKitRoom>
  );
}
