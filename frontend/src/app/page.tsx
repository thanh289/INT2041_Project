"use client";

import { useState } from "react";
import LiveKitRoomWrapper from "@/components/LiveKitRoomWrapper";

// ---- Decorative Aurora Orbs ----
function AuroraOrb({ className }: { className: string }) {
  return <div className={`aurora-orb ${className}`} aria-hidden="true" />;
}

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
            timestamp: position.timestamp,
          };
          localStorage.setItem("user_coords", JSON.stringify(coords));
        },
        (error) => console.warn("Location error:", error.message),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
      );
    }
    setConnect(true);
  };

  if (connect) {
    return (
      <div className="home-page fixed inset-0 z-10 w-full h-full">
        {/* Background Effects for consistent look */}
        <div className="grid-overlay" />
        <div className="sonar-sweep" />
        <AuroraOrb className="orb-1" />
        <AuroraOrb className="orb-2" />
        <AuroraOrb className="orb-3" />
        
        {/* Workspace Content */}
        <div className="relative z-10 w-full h-full flex flex-col">
          <LiveKitRoomWrapper roomName={roomName} username={username} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="home-page" role="main">
        {/* Background Effects */}
        <div className="grid-overlay" />
        <div className="sonar-sweep" />
        
        {/* Glowing Orbs */}
        <AuroraOrb className="orb-1" />
        <AuroraOrb className="orb-2" />
        <AuroraOrb className="orb-3" />

        {/* Logo bar */}
        <div className="home-logo-bar">
          <span className="home-logo-name">Vision Assistant</span>
        </div>

        {/* Hero */}
        <section className="home-hero">
          <div className="hero-glass-card">
            <h1 className="home-title">
              Navigate Your World<br />With Confidence
            </h1>
            <p className="home-desc">
              Empowering everyday independence with real-time AI audio-vision assistance.<br />
              Explore your surroundings, read documents, and connect with ease.
            </p>

            <button
              onClick={handleStartConnection}
              className="start-btn"
              aria-label="Tap to connect and start the voice assistant"
            >
              <span className="start-btn-label">Start</span>
              <span className="start-btn-sub">Tap anywhere to connect</span>
            </button>
          </div>
        </section>

        {/* Volume hint */}
        <div className="volume-hint" role="note" aria-live="polite">
          <p>
            Screen reader optimized &mdash; please set your device volume to{" "}
            <strong>80% or higher</strong>
          </p>
        </div>

        {/* Wave deco */}
        <div className="wave-deco" aria-hidden="true" />
      </div>
    </>
  );
}