"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";

import AgentWorkspace from "./AgentWorkspace";

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
        const resp = await fetch(`/api/livekit/token?room=${roomName}&username=${username}`);
        const data = await resp.json();
        if (isMounted && data.token) setToken(data.token);
      } catch (e) {
        console.error("Token fetch error:", e);
      }
    };
    fetchToken();
    return () => { isMounted = false; };
  }, [roomName, username]);

  if (!token) {
    return (
      <div
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 50%, #0f2d4a 100%)",
          gap: "1.5rem",
        }}
      >
        {/* Animated logo mark */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--color-primary), #38bdf8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(9,141,113,0.6)",
          animation: "logoBreath 2s ease-in-out infinite",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
              fill="white" />
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            animation: "fadeInOut 1.8s ease-in-out infinite",
          }}>
            Đang khởi động...
          </p>
          <p style={{
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            fontSize: "0.9rem",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.05em",
            marginTop: "0.375rem",
          }}>
            Đang kết nối phiên làm việc
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          width: 200, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg, var(--color-primary), #7dd3fc)",
            borderRadius: 2,
            animation: "loadBar 1.6s ease-in-out infinite",
          }} />
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');
          @keyframes logoBreath {
            0%,100% { transform: scale(1); box-shadow: 0 0 40px rgba(9,141,113,0.6); }
            50%      { transform: scale(1.06); box-shadow: 0 0 60px rgba(9,141,113,0.8); }
          }
          @keyframes fadeInOut {
            0%,100% { opacity: 0.7; }
            50%      { opacity: 1; }
          }
          @keyframes loadBar {
            0%   { width: 0%; margin-left: 0; }
            50%  { width: 70%; margin-left: 0; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{
        height: "100vh", width: "100%",
        display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 60%, #0f2d4a 100%)",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      <RoomAudioRenderer />
      <AgentWorkspace />
    </LiveKitRoom>
  );
}