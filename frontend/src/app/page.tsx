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
      <div className="fixed inset-0 z-10 w-full h-full bg-forest-deep">
        <LiveKitRoomWrapper roomName={roomName} username={username} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .home-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f2d4a 0%, #0c1e35 50%, #0f2d4a 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Atkinson Hyperlegible', sans-serif;
        }

        /* ---- Decorative Aurora Orbs ---- */
        .aurora-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          pointer-events: none;
          animation: floatOrb 12s ease-in-out infinite alternate;
        }
        
        .orb-1 {
          width: 50vw; height: 50vw;
          max-width: 600px; max-height: 600px;
          background: radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%);
          top: -10%; left: -10%;
          animation-duration: 14s;
        }
        .orb-2 {
          width: 40vw; height: 40vw;
          max-width: 500px; max-height: 500px;
          background: radial-gradient(circle, rgba(9,141,113,0.3) 0%, transparent 70%);
          bottom: -10%; right: -5%;
          animation-duration: 18s;
          animation-delay: -4s;
        }
        .orb-3 {
          width: 35vw; height: 35vw;
          max-width: 400px; max-height: 400px;
          background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%);
          top: 30%; left: 40%;
          animation-duration: 20s;
          animation-delay: -8s;
        }

        @keyframes floatOrb {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(5%, 8%) scale(1.1); }
          100% { transform: translate(-5%, -5%) scale(0.95); }
        }

        /* ---- Grid Overlay ---- */
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 1;
        }

        /* ---- Sonar Sweep ---- */
        .sonar-sweep {
          position: absolute;
          top: 50%; left: 50%;
          width: 200vmax; height: 200vmax;
          background: conic-gradient(from 0deg, transparent 75%, rgba(14,165,233,0.15) 100%);
          transform-origin: center;
          animation: sweep 10s linear infinite;
          pointer-events: none;
          z-index: 2;
          border-radius: 50%;
          margin-top: -100vmax; margin-left: -100vmax;
        }
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }



        /* ---- Logo bar ---- */
        .home-logo-bar {
          position: relative;
          z-index: 10;
          width: 100%;
          padding: 1.5rem 2.5rem 0;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .home-logo-name {
          font-size: 1.75rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 2px;
        }

        /* ---- Hero ---- */
        .home-hero {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem 1rem;
          text-align: center;
          max-width: 860px;
          width: 100%;
        }

        /* ---- Glass Card for Hero ---- */
        .hero-glass-card {
          background: rgba(12, 30, 53, 0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 2.5rem;
          padding: 3.5rem 2.5rem;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .hero-glass-card::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transform: skewX(-20deg);
          animation: shine 7s infinite;
        }
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }

        .home-title {
          font-size: clamp(2.5rem, 7vw, 5rem);
          font-weight: 700;
          color: #fff;
          line-height: 1.15;
          letter-spacing: 0.04em;
          margin-bottom: 1.25rem;
          text-shadow:
            0 0 8px rgba(255,255,255,0.5),
            0 0 16px rgba(255,255,255,0.25),
            2px 2px 6px rgba(0,0,0,0.4);
          animation: titleGlow 3s ease-in-out infinite alternate;
        }
        @keyframes titleGlow {
          from { text-shadow: 0 0 8px rgba(255,255,255,0.4), 2px 2px 6px rgba(0,0,0,0.4); }
          to   { text-shadow: 0 0 16px rgba(255,255,255,0.65), 0 0 30px rgba(9,141,113,0.3), 2px 2px 6px rgba(0,0,0,0.4); }
        }

        .home-desc {
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          color: rgba(255,255,255,0.88);
          line-height: 1.7;
          letter-spacing: 0.03em;
          margin-bottom: 2.5rem;
        }

        /* ---- START button ---- */
        .start-btn {
          position: relative;
          width: min(100%, 520px);
          padding: 2.25rem 2rem;
          border-radius: 2rem;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, var(--color-primary) 0%, #38bdf8 50%, #0284c7 100%);
          box-shadow:
            0 0 0 6px rgba(9,141,113,0.25),
            0 12px 40px rgba(9,141,113,0.5),
            0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          overflow: hidden;
          /* 3D press effect */
          border-bottom: 8px solid #056650;
        }
        .start-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 55%);
          border-radius: inherit;
          pointer-events: none;
        }
        .start-btn:hover {
          transform: translateY(-3px) scale(1.01);
          box-shadow:
            0 0 0 8px rgba(9,141,113,0.3),
            0 18px 50px rgba(9,141,113,0.6),
            0 4px 16px rgba(0,0,0,0.3);
        }
        .start-btn:active {
          transform: translateY(2px) scale(0.99);
          box-shadow:
            0 0 0 4px rgba(9,141,113,0.2),
            0 6px 20px rgba(9,141,113,0.4);
          border-bottom-width: 3px;
        }
        .start-btn:focus-visible {
          outline: 4px solid #FACC15;
          outline-offset: 4px;
        }

        .start-btn-label {
          display: block;
          font-family: 'Atkinson Hyperlegible', sans-serif;
          font-size: clamp(2rem, 6vw, 3.25rem);
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-shadow: 0 2px 8px rgba(0,0,0,0.3);
          margin-bottom: 0.4rem;
        }
        .start-btn-sub {
          display: block;
          font-size: clamp(0.9rem, 2vw, 1.1rem);
          font-weight: 400;
          color: rgba(255,255,255,0.85);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* ---- Volume hint ---- */
        .volume-hint {
          position: relative;
          z-index: 10;
          width: min(100%, 640px);
          margin: 0 auto 2rem;
          padding: 1.25rem 1.75rem;
          background: rgba(255,255,255,0.07);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 1.5rem;
          text-align: center;
          backdrop-filter: blur(8px);
        }
        .volume-hint p {
          font-size: clamp(0.95rem, 2vw, 1.15rem);
          color: rgba(255,255,255,0.9);
          font-weight: 400;
          line-height: 1.6;
        }
        .volume-hint strong {
          color: #7dd3fc;
          font-weight: 700;
          font-size: 1.2em;
        }

        /* ---- Wave decoration at bottom ---- */
        .wave-deco {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 120px;
          background: rgba(0,0,0,0.15);
          border-radius: 50% 50% 0 0 / 80% 80% 0 0;
          z-index: 5;
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .home-hero { padding: 1rem; }
          .hero-glass-card { padding: 2rem 1.25rem; border-radius: 1.5rem; }
          .home-title { font-size: 2.25rem; }
        }
      `}</style>

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