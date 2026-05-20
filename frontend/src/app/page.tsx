"use client";

import { useState } from "react";
import LiveKitRoomWrapper from "@/components/LiveKitRoomWrapper";

export default function Home() {
  const [connect, setConnect] = useState(false);
  const [username, setUsername] = useState("");
  const roomName = "accessibility_hub";

  const handleStartConnection = () => {
    let storedUser = localStorage.getItem("accessibility_username");
    if (!storedUser) {
      storedUser = `User_${Math.floor(Math.random() * 100000)}`;
      localStorage.setItem("accessibility_username", storedUser);
    }
    setUsername(storedUser);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          localStorage.setItem("user_coords", JSON.stringify(coords));
          console.log("Location captured:", coords);
        },
        (error) => {
          console.warn("Location error:", error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60000
        }
      );
    }
    setConnect(true);
  };

  return (
    <main className="relative flex flex-col items-center justify-center w-full min-h-screen bg-[#000000] text-[#FFFFFF] overflow-hidden selection:bg-yellow-400 selection:text-black font-sans">

      {connect ? (
        <div className="absolute inset-0 z-10 w-full h-full bg-black transition-opacity duration-1000 ease-in-out opacity-100">
          <LiveKitRoomWrapper roomName={roomName} username={username} />
        </div>
      ) : (
        <div className="z-10 flex flex-col items-center justify-center w-full h-screen p-8 transition-opacity duration-700 ease-in-out opacity-100 bg-black">

          <div className="w-full flex-1 flex flex-col items-center justify-center max-w-5xl">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-12 text-center uppercase tracking-widest text-[#FFFFFF] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] leading-tight">
              Vision <br className="md:hidden" /> Assistant
            </h1>

            <button
              onClick={handleStartConnection}
              aria-label="Double tap anywhere on this large button to connect and start the assistant."
              className="group relative w-full h-[300px] md:h-[400px] rounded-[3rem] bg-[#111111] border-[12px] border-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.5)] hover:shadow-[0_0_120px_rgba(250,204,21,0.8)] transition-all duration-300 hover:scale-[1.02] hover:bg-[#1a1a1a] active:scale-95 focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-cyan-400 border-b-[20px] border-b-yellow-600 flex flex-col items-center justify-center"
            >
              <span className="text-6xl md:text-8xl lg:text-[7rem] font-black uppercase text-yellow-400 group-hover:text-yellow-300 tracking-wider mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
                START
              </span>
              <span className="text-3xl md:text-4xl font-extrabold text-[#FFFFFF] group-hover:text-gray-100 tracking-wide uppercase px-4 text-center">
                Tap Anywhere To Connect
              </span>
            </button>
          </div>

          <div
            className="mt-12 text-center w-full max-w-4xl bg-[#111111] border-[6px] border-white/20 rounded-[2rem] p-8 shadow-2xl shrink-0"
            role="doc-subtitle"
            aria-live="polite"
          >
            <p className="text-3xl md:text-4xl text-[#FFFFFF] font-bold leading-relaxed">
              Screen reader optimized. <br className="hidden md:block" /> Please set device volume to <span className="text-yellow-400 uppercase font-black text-4xl md:text-5xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">80% or higher</span>.
            </p>
          </div>

        </div>
      )}
    </main>
  );
}