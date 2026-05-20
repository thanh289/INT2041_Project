"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";

import AgentWorkspace from "./AgentWorkspace";

// --- MAIN WRAPPER COMPONENT ---
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
        console.error("Token fetch error:", e);
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
        className="flex items-center justify-center min-h-screen text-4xl md:text-6xl text-yellow-400 bg-black font-black uppercase tracking-widest w-full"
        aria-live="polite"
      >
        <span className="animate-pulse drop-shadow-[0_0_30px_rgba(250,204,21,0.8)]">Starting Session...</span>
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
      className="h-screen w-full font-sans flex flex-col bg-black text-white relative overflow-hidden"
      onConnected={() => {
        console.log("Connected to room!");
        const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...");
        beep.play().catch(e => console.log(e));
      }}
    >
      <RoomAudioRenderer />

      {/* Delegating layout and tab management to AgentWorkspace */}
      <AgentWorkspace />

    </LiveKitRoom>
  );
}