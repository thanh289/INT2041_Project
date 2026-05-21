"use client";

import { useState } from "react";
import LiveKitRoomWrapper from "@/components/LiveKitRoomWrapper";

// ---- Decorative leaf component ----
function Leaf({ className }: { className: string }) {
  return <div className={`leaf ${className}`} aria-hidden="true" />;
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

        /* ---- Decorative leaves ---- */
        .leaf {
          position: absolute;
          background: linear-gradient(135deg,
            rgba(76,145,100,0.7) 0%,
            rgba(60,120,80,0.8) 40%,
            rgba(45,95,65,0.9) 70%,
            rgba(35,75,50,0.95) 100%
          );
          border-radius: 50% 0;
          pointer-events: none;
          box-shadow:
            8px 8px 20px rgba(0,0,0,0.4),
            -2px -2px 10px rgba(255,255,255,0.1),
            inset 5px 5px 15px rgba(100,160,120,0.3),
            inset -5px -5px 15px rgba(20,40,30,0.4);
        }
        .leaf::before {
          content: '';
          position: absolute;
          width: 2px; height: 90%;
          background: linear-gradient(to bottom, rgba(80,130,90,0.8), rgba(50,90,60,0.9));
          left: 45%; top: 10%;
          transform: translateX(-50%) rotate(-147deg);
          border-radius: 2px;
        }
        .leaf::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50% 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
        }
        .leaf-1 { width:180px;height:280px; top:5%;  left:-5%;  transform:rotate(-20deg); opacity:0.85; animation:leafFloat1 6s ease-in-out infinite; }
        .leaf-2 { width:150px;height:230px; top:15%; left:8%;   transform:rotate(10deg);  opacity:0.75; animation:leafFloat2 7s ease-in-out infinite; }
        .leaf-3 { width:200px;height:300px; top:40%; left:-8%;  transform:rotate(-30deg); opacity:0.9;  animation:leafFloat1 8s ease-in-out infinite; }
        .leaf-4 { width:120px;height:180px; bottom:10%;left:5%; transform:rotate(15deg);  opacity:0.7;  animation:leafFloat2 5s ease-in-out infinite; }
        .leaf-5 { width:160px;height:240px; top:10%; right:5%;  transform:rotate(25deg) scaleX(-1);  opacity:0.8;  animation:leafFloat1 7s ease-in-out infinite; }
        .leaf-6 { width:190px;height:280px; top:35%; right:-5%; transform:rotate(-15deg) scaleX(-1); opacity:0.85; animation:leafFloat2 6s ease-in-out infinite; }
        .leaf-7 { width:140px;height:210px; bottom:15%;right:8%;transform:rotate(20deg) scaleX(-1);  opacity:0.75; animation:leafFloat1 5.5s ease-in-out infinite; }
        .leaf-8 { width:110px;height:170px; bottom:-5%;right:-3%;transform:rotate(-25deg) scaleX(-1);opacity:0.7;  animation:leafFloat2 6.5s ease-in-out infinite; }

        @keyframes leafFloat1 {
          0%,100% { transform: rotate(-20deg) translateY(0); }
          50%      { transform: rotate(-20deg) translateY(-8px); }
        }
        @keyframes leafFloat2 {
          0%,100% { transform: rotate(10deg) translateY(0); }
          50%      { transform: rotate(10deg) translateY(6px); }
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
          padding: 2rem 2rem 1rem;
          text-align: center;
          max-width: 820px;
          width: 100%;
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
          .leaf { display: none; }
          .home-hero { padding: 1.5rem 1rem; }
        }
      `}</style>

      <div className="home-page" role="main">
        {/* Leaves */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <Leaf key={n} className={`leaf-${n}`} />)}

        {/* Logo bar */}
        <div className="home-logo-bar">
          <span className="home-logo-name">Vision Assistant</span>
        </div>

        {/* Hero */}
        <section className="home-hero">
          <h1 className="home-title">
            Illuminating Your<br />World with AI
          </h1>
          <p className="home-desc">
            AI-powered voice &amp; vision assistance —<br />
            object detection, navigation, chat support,<br />
            and more, designed for everyone.
          </p>

          <button
            onClick={handleStartConnection}
            className="start-btn"
            aria-label="Tap to connect and start the voice assistant"
          >
            <span className="start-btn-label">Start</span>
            <span className="start-btn-sub">Tap anywhere to connect</span>
          </button>
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