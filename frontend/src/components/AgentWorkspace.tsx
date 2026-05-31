"use client";

import { FormEvent, useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  useLocalParticipant,
  useVoiceAssistant,
  VideoTrack,
  useRemoteParticipants,
  useTrackTranscription,
  useChat,
} from "@livekit/components-react";
import type { ReceivedChatMessage } from "@livekit/components-core";
import {
  CameraOff,
  FileText,
  MessageSquareText,
  Mic,
  MicOff,
  Camera,
  Send,
  Home,
  AlertTriangle,
  Upload,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SendTextOptions } from "livekit-client";
import { Track } from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";
import { useAgentEvents } from "../hooks/useAgentEvents";

type TabId = "home" | "chat" | "files" | "emergency";

type UnifiedMessage = {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: number;
};

// ─────────────────────────────────────────
// CUSTOM HOOK: UNIFIED MESSAGES
// ─────────────────────────────────────────
function useUnifiedMessages() {
  const { localParticipant } = useLocalParticipant();
  const { agentTranscriptions } = useVoiceAssistant();
  const [externalUserMessages, setExternalUserMessages] = useState<UnifiedMessage[]>([]);

  const { chatMessages, send } = useChat();
  const recentChatSendsRef = useRef<Array<{ text: string; timestamp: number }>>([]);

  const normalizeText = useCallback((value: string) => {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }, []);

  const trackRecentSend = useCallback((text: string) => {
    const now = Date.now();
    const normalized = normalizeText(text);
    const next = recentChatSendsRef.current
      .filter((entry) => now - entry.timestamp < 15000)
      .concat({ text: normalized, timestamp: now });
    recentChatSendsRef.current = next.slice(-10);
  }, [normalizeText]);

  const sendChat = useCallback(async (text: string, options?: SendTextOptions) => {
    trackRecentSend(text);
    return send(text, options);
  }, [send, trackRecentSend]);

  const userTrackRef = useMemo(() => {
    return localParticipant ? {
      participant: localParticipant,
      source: Track.Source.Microphone,
    } : undefined;
  }, [localParticipant]);

  const { segments: userTranscriptions } = useTrackTranscription(userTrackRef);

  const unifiedMessages = useMemo(() => {
    const combined: UnifiedMessage[] = [];

    chatMessages.forEach((msg) => {
      combined.push({
        id: msg.id,
        sender: msg.from?.identity === localParticipant?.identity ? "user" : "agent",
        text: msg.message,
        timestamp: msg.timestamp ?? 0,
      });
    });

    userTranscriptions.forEach((s) => {
      if (s.text.trim()) {
        combined.push({
          id: s.id,
          sender: "user",
          text: s.text,
          timestamp: s.firstReceivedTime ?? s.lastReceivedTime ?? 0,
        });
      }
    });

    agentTranscriptions.forEach((s) => {
      if (s.text.trim()) {
        combined.push({
          id: s.id,
          sender: "agent",
          text: s.text,
          timestamp: s.firstReceivedTime ?? s.lastReceivedTime ?? 0,
        });
      }
    });

    externalUserMessages.forEach((msg) => {
      if (!msg.text.trim()) return;
      const normalized = normalizeText(msg.text);
      const isDuplicate = recentChatSendsRef.current.some(
        (entry) => entry.text === normalized && Math.abs(entry.timestamp - msg.timestamp) < 7000
      );
      if (!isDuplicate) {
        combined.push(msg);
      }
    });

    combined.sort((a, b) => a.timestamp - b.timestamp);
    return combined;
  }, [chatMessages, userTranscriptions, agentTranscriptions, externalUserMessages, localParticipant]);

  const addExternalUserMessage = useCallback((message: UnifiedMessage) => {
    setExternalUserMessages((prev) => {
      if (prev.some((existing) => existing.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  return { unifiedMessages, send: sendChat, addExternalUserMessage };
}

// ─────────────────────────────────────────
// REUSABLE CONVERSATION LOG
// ─────────────────────────────────────────
function ConversationLogBox({ unifiedMessages }: { unifiedMessages: UnifiedMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [unifiedMessages]);

  return (
    <div className="home-right-col" role="log" aria-live="polite" aria-label="Quick conversation log">
      <div className="mini-chat-header">
        <MessageSquareText size={18} color="#7dd3fc" aria-hidden="true" />
        <span className="mini-chat-title">Conversation Log</span>
      </div>
      <div ref={scrollRef} className="mini-chat-body">
        {unifiedMessages.length === 0 && (
          <div style={{
            margin: "auto", textAlign: "center",
            color: "rgba(255,255,255,0.25)", fontWeight: 700,
            fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
          }}>
            No messages yet
          </div>
        )}

        {unifiedMessages.map((msg) => (
          msg.sender === "user" ? (
            <div key={`mini-u-${msg.id}`} className="mini-msg-user">
              {msg.text}
            </div>
          ) : (
            <div key={`mini-a-${msg.id}`} className="mini-msg-agent">
              <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#7dd3fc", marginBottom: "0.15rem", textTransform: "uppercase" }}>
                Assistant
              </span>
              {msg.text}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// STATUS HEADER
// ─────────────────────────────────────────
function StatusHeader() {
  const remoteParticipants = useRemoteParticipants();
  const isConnected = remoteParticipants.length > 0;

  return (
    <header
      className="w-full shrink-0 z-20"
      role="region"
      aria-label="Connection Status"
      style={{
        background: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 100%)",
        borderBottom: "3px solid rgba(56, 189, 248, 0.4)", // Đổi sang viền xanh cyan sáng
        padding: "1rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", // Đồng nhất màu nút Start
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(14,165,233,0.5)",
          flexShrink: 0,
        }}>
          <Eye size={22} color="#fff" aria-hidden="true" />
        </div>
        <span style={{
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.05em",
        }}>
          Vision Assistant
        </span>
      </div>

      {/* Status pill */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.45rem 1rem",
          borderRadius: 9999,
          background: isConnected ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.08)",
          border: `2px solid ${isConnected ? "#38bdf8" : "rgba(255,255,255,0.2)"}`,
          fontSize: "0.9rem",
          fontWeight: 700,
          color: isConnected ? "#7dd3fc" : "rgba(255,255,255,0.6)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{
          width: 8, height: 8,
          borderRadius: "50%",
          background: isConnected ? "#7dd3fc" : "rgba(255,255,255,0.3)",
          flexShrink: 0,
          ...(isConnected ? { animation: "pulse-dot 2s ease-in-out infinite" } : {}),
        }} />
        {isConnected ? "Connected" : "Waiting..."}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.6; transform:scale(1.3); }
        }
      `}</style>
    </header>
  );
}

// ─────────────────────────────────────────
// MIC / CAM CONTROL BAR (above bottom nav)
// ─────────────────────────────────────────
function ControlBar() {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMic = () => localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant?.setCameraEnabled(!isCameraEnabled);

  return (
    <div style={{
      display: "flex",
      gap: "0.75rem",
      padding: "0.875rem 1rem",
      background: "rgba(15, 45, 74, 0.95)", // Đổi từ xanh lá sẫm sang xanh dương sẫm của hệ thống
      borderTop: "2px solid rgba(56, 189, 248, 0.3)", // Đổi viền sang màu xanh cyan sáng
      flexShrink: 0,
      zIndex: 20,
    }}
      role="region"
      aria-label="Mic and camera controls"
    >
      {/* Mic button */}
      <button
        onClick={toggleMic}
        aria-label={isMicrophoneEnabled ? "Microphone is ON. Tap to turn OFF." : "Microphone is OFF. Tap to turn ON."}
        style={{
          flex: 1,
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          borderRadius: 16,
          border: isMicrophoneEnabled ? "3px solid #ffffff" : "3px solid rgba(239,68,68,0.5)",
          background: isMicrophoneEnabled
            ? "linear-gradient(135deg, #0ea5e9, #38bdf8)" // Đổi sang màu gradient Start của Landing Page
            : "rgba(239,68,68,0.08)",
          color: isMicrophoneEnabled ? "#ffffff" : "#f87171", // Khi ON thì chữ màu trắng
          cursor: "pointer",
          transition: "all 0.2s ease",
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          boxShadow: isMicrophoneEnabled ? "0 4px 16px rgba(14,165,233,0.4)" : "none",
        }}
      >
        {isMicrophoneEnabled
          ? <Mic size={28} aria-hidden="true" />
          : <MicOff size={28} aria-hidden="true" />}
        <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {isMicrophoneEnabled ? "Mic On" : "Mic Off"}
        </span>
      </button>

      {/* Camera button */}
      <button
        onClick={toggleCam}
        aria-label={isCameraEnabled ? "Camera is ON. Tap to turn OFF." : "Camera is OFF. Tap to turn ON."}
        style={{
          flex: 1,
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          borderRadius: 16,
          border: isCameraEnabled ? "3px solid #ffffff" : "3px solid rgba(239,68,68,0.5)", // Đồng bộ viền đỏ khi OFF
          background: isCameraEnabled
            ? "linear-gradient(135deg, #0ea5e9, #38bdf8)" // Đổi sang màu gradient Start của Landing Page
            : "rgba(239,68,68,0.08)", // Đồng bộ nền đỏ nhạt khi OFF
          color: isCameraEnabled ? "#ffffff" : "#f87171", // Khi ON chữ trắng, khi OFF chữ đỏ đồng bộ
          cursor: "pointer",
          transition: "all 0.2s ease",
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          boxShadow: isCameraEnabled ? "0 4px 16px rgba(14,165,233,0.4)" : "none",
        }}
      >
        {isCameraEnabled
          ? <Camera size={28} aria-hidden="true" />
          : <CameraOff size={28} aria-hidden="true" />}
        <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {isCameraEnabled ? "Camera On" : "Camera Off"}
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// BOTTOM NAVBAR PILL (SightTech MenuBar style)
// ─────────────────────────────────────────
function BottomNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
}) {
  const tabs: { id: TabId; icon: LucideIcon; label: string }[] = [
    { id: "home", icon: Home, label: "Home" },
    { id: "chat", icon: MessageSquareText, label: "Chat" },
    { id: "files", icon: FileText, label: "Files" },
    { id: "emergency", icon: AlertTriangle, label: "SOS" },
  ];

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "relative",
        zIndex: 30,
        padding: "0 1rem 1.25rem",
        background: "transparent",
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
        backgroundImage: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 100%)",
        borderTop: "3px solid rgba(56, 189, 248, 0.3)", // Đổi sang viền xanh dương sáng
        paddingTop: "0.875rem",
      }}
    >
      <div
        role="menubar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          padding: "0.5rem 0.75rem",
          borderRadius: 9999,
          border: "1.5px solid rgba(255,255,255,0.15)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
          width: "100%",
          maxWidth: 440,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const isEmergency = tab.id === "emergency";

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="menuitem"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
                padding: "0.625rem 0.25rem",
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.175,0.885,0.32,1.275)",
                background: isActive
                  ? isEmergency
                    ? "linear-gradient(135deg, #dc2626, #ef4444)"
                    : "linear-gradient(135deg, #0ea5e9, #38bdf8)"
                  : "transparent",
                color: isActive ? "#fff" : isEmergency ? "#f87171" : "rgba(255,255,255,0.55)",
                boxShadow: isActive
                  ? isEmergency
                    ? "0 6px 20px rgba(220,38,38,0.5)"
                    : "0 6px 20px rgba(14,165,233,0.5)"
                  : "none",
                transform: isActive ? "translateY(-4px) scale(1.08)" : "none",
              }}
            >
              <Icon
                size={isActive ? 26 : 22}
                aria-hidden="true"
                style={{ transition: "all 0.3s ease" }}
              />
              <span style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        nav button:focus-visible {
          outline: 4px solid #FACC15 !important;
          outline-offset: 3px;
        }
      `}</style>
    </nav>
  );
}

// ─────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────
function HomeTab({ unifiedMessages }: { unifiedMessages: UnifiedMessage[] }) {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);
  const trackRef = localParticipant && cameraPublication
    ? { participant: localParticipant, source: Track.Source.Camera, publication: cameraPublication }
    : null;

  return (
    <div className="home-tab-container">
      {/* Left Column: Visualizer and Camera */}
      <div className="home-left-col">
        {/* Audio visualizer background */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: isCameraEnabled ? 0.2 : 0.85,
          transition: "opacity 0.5s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AudioVisualizer />
        </div>

        {/* Camera / placeholder card */}
        {/* Camera / placeholder card */}
        <div style={{
          position: "relative", zIndex: 10,
          width: "100%",
          borderRadius: 20,
          overflow: "hidden",
          border: `3px solid ${isCameraEnabled ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
          boxShadow: isCameraEnabled ? "0 0 30px rgba(14, 165, 233, 0.3)" : "none",
          background: "#000000", // <-- Thay đổi giá trị này từ "#0a1a14" thành "#000000"
          aspectRatio: "16/9",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isCameraEnabled && trackRef ? (
            <>
              {/* Live badge */}
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 10,
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 12px", borderRadius: 9999,
                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
                border: "1.5px solid rgba(56, 189, 248, 0.5)",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7dd3fc", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7dd3fc", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Vision Active
                </span>
              </div>
              <VideoTrack trackRef={trackRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem",
              padding: "2rem",
            }}>
              <CameraOff size={52} color="rgba(255,255,255,0.25)" aria-hidden="true" />
              <span style={{
                fontSize: "1rem", fontWeight: 700, color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
              }}>
                Camera is OFF
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Mini Chatbox */}
      <ConversationLogBox unifiedMessages={unifiedMessages} />
    </div>
  );
}

// ─────────────────────────────────────────
// CHAT TAB
// ─────────────────────────────────────────
type SendChatMessage = (message: string, options?: SendTextOptions) => Promise<ReceivedChatMessage>;

function ChatTab({ unifiedMessages, send }: { unifiedMessages: UnifiedMessage[]; send: SendChatMessage }) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [unifiedMessages]);

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    await send(text);
    setMessage("");
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "0.875rem", overflow: "hidden", gap: "0.75rem",
    }}>
      {/* Message list */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Chat history"
        style={{
          flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
          gap: "0.75rem", padding: "1rem",
          background: "rgba(0,0,0,0.25)",
          borderRadius: 20,
          border: "2px solid rgba(56, 189, 248, 0.25)", // Đổi sang viền xanh dương nhẹ
        }}
      >
        {unifiedMessages.length === 0 && (
          <div style={{
            margin: "auto", textAlign: "center",
            color: "rgba(255,255,255,0.3)", fontWeight: 700,
            fontSize: "1rem", letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
          }}>
            No messages yet
          </div>
        )}

        {unifiedMessages.map((msg) => (
          msg.sender === "user" ? (
            <div key={`u-${msg.id}`} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                maxWidth: "80%", padding: "0.75rem 1.1rem",
                borderRadius: "18px 18px 4px 18px",
                background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
                boxShadow: "0 4px 12px rgba(14,165,233,0.35)",
                color: "#fff",
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
                fontSize: "1rem", lineHeight: 1.6,
              }}>
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={`a-${msg.id}`} style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                maxWidth: "80%", padding: "0.75rem 1.1rem",
                borderRadius: "18px 18px 18px 4px",
                background: "rgba(255,255,255,0.08)",
                border: "2px solid rgba(56, 189, 248, 0.3)",
                color: "#fff",
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
                fontSize: "1rem", lineHeight: 1.6,
              }}>
                <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#7dd3fc", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Assistant
                </span>
                {msg.text}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        style={{ display: "flex", gap: "0.625rem", flexShrink: 0 }}
      >
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          aria-label="Type a message to chat with AI"
          style={{
            flex: 1, padding: "0.875rem 1.25rem",
            borderRadius: 14,
            background: "rgba(255,255,255,0.07)",
            border: "2px solid rgba(56, 189, 248, 0.35)", // Đổi sang viền xanh dương nhẹ
            color: "#fff",
            fontSize: "1rem",
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#38bdf8")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(56, 189, 248, 0.35)")}
        />
        <button
          type="submit"
          aria-label="Send message"
          style={{
            padding: "0 1.25rem",
            borderRadius: 14,
            background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(14,165,233,0.4)",
            transition: "transform 0.15s, box-shadow 0.15s",
            minWidth: 52,
          }}
          onMouseEnter={(e) => { (e.currentTarget.style.transform = "scale(1.05)"); }}
          onMouseLeave={(e) => { (e.currentTarget.style.transform = "scale(1)"); }}
        >
          <Send size={22} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────
// FILES TAB
// ─────────────────────────────────────────
function FilesTab({ unifiedMessages }: { unifiedMessages: UnifiedMessage[] }) {
  const { localParticipant } = useLocalParticipant();
  const [status, setStatus] = useState("Ready to receive file");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localParticipant) return;
    setStatus(`Processing: ${file.name}...`);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await localParticipant.sendText(`File uploaded: ${file.name}. Please summarize the content.`, { topic: "lk.chat" });
        setStatus(`Sent: ${file.name}`);
      } catch {
        setStatus("Error sending file to AI.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="home-tab-container">
      {/* Left Column: File Upload */}
      <div className="home-left-col" style={{ background: "transparent", border: "none" }}>
        <div style={{
          width: "100%", maxWidth: 560,
          background: "rgba(0,0,0,0.2)",
          border: "3px solid rgba(56, 189, 248, 0.35)", // Đổi sang viền xanh dương nhẹ
          borderRadius: 24,
          padding: "2rem 1.5rem",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem",
          textAlign: "center",
          margin: "auto",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(56, 189, 248, 0.15)", // Đổi sang nền xanh dương nhẹ
            border: "3px solid rgba(56, 189, 248, 0.4)", // Đổi sang viền xanh dương nhẹ
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileText size={38} color="#7dd3fc" aria-hidden="true" />
          </div>

          <div>
            <h2 style={{
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
              fontSize: "1.375rem", fontWeight: 700, color: "#fff",
              letterSpacing: "0.04em", marginBottom: "0.5rem",
            }}>
              Assistant File Reader
            </h2>
            <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
              Upload a text file for the AI to read and summarize the content for you.
            </p>
          </div>

          <label
            tabIndex={0}
            role="button"
            aria-label="Upload file to read"
            style={{
              width: "100%", minHeight: 140,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "0.75rem",
              borderRadius: 18,
              border: "3px dashed rgba(56, 189, 248, 0.5)", // Đổi sang viền xanh dương nhẹ
              background: "rgba(56, 189, 248, 0.06)", // Đổi sang nền xanh dương nhẹ
              cursor: "pointer",
              transition: "all 0.2s ease",
              padding: "1.5rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget.style.background = "rgba(56, 189, 248, 0.12)");
              (e.currentTarget.style.borderColor = "#38bdf8");
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.background = "rgba(56, 189, 248, 0.06)");
              (e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.5)");
            }}
          >
            <Upload size={36} color="#7dd3fc" aria-hidden="true" />
            <span style={{
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
              fontSize: "1rem", fontWeight: 700, color: "#7dd3fc",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {status}
            </span>
            <input
              type="file"
              accept=".txt,.md,.json,.csv,.pdf"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      {/* Right Column: Mini Chatbox */}
      <ConversationLogBox unifiedMessages={unifiedMessages} />
    </div>
  );
}

// ─────────────────────────────────────────
// EMERGENCY TAB
// ─────────────────────────────────────────
function EmergencyTab() {
  const { localParticipant } = useLocalParticipant();

  const triggerSos = async () => {
    if (!localParticipant) {
      alert("Not connected to assistant.");
      return;
    }
    let coords: unknown = null;
    const coordsStr = localStorage.getItem("user_coords");
    if (coordsStr) {
      try { coords = JSON.parse(coordsStr); } catch { /* ignore */ }
    }
    try {
      const payload = { type: "sos_trigger", data: coords };
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
      alert("SOS sent. Notifying emergency contacts.");
    } catch {
      alert("SOS failed. Please try again.");
    }
  };

  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(0,0,0,0.25)",
        border: "3px solid rgba(239,68,68,0.4)",
        borderRadius: 24,
        padding: "2rem 1.5rem",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem",
        textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(239,68,68,0.12)",
          border: "3px solid rgba(239,68,68,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={34} color="#f87171" aria-hidden="true" />
        </div>

        <div>
          <h2 style={{
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            fontSize: "1.375rem", fontWeight: 700, color: "#fff",
            marginBottom: "0.5rem",
          }}>
            Emergency SOS
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            Tap the button below to send location and emergency alert.
          </p>
        </div>

        <button
          onClick={triggerSos}
          aria-label="Send SOS signal now"
          style={{
            width: "100%", minHeight: 120,
            borderRadius: 20,
            border: "3px solid rgba(220,38,38,0.7)",
            background: "linear-gradient(135deg, #dc2626, #ef4444)",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            fontSize: "2rem", fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            boxShadow: "0 8px 32px rgba(220,38,38,0.45)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget.style.transform = "scale(1.02)"); }}
          onMouseLeave={(e) => { (e.currentTarget.style.transform = "scale(1)"); }}
          onMouseDown={(e) => { (e.currentTarget.style.transform = "scale(0.98)"); }}
          onMouseUp={(e) => { (e.currentTarget.style.transform = "scale(1.02)"); }}
        >
          SEND SOS
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN WORKSPACE
// ─────────────────────────────────────────
export default function AgentWorkspace() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const { unifiedMessages, send, addExternalUserMessage } = useUnifiedMessages();

  useAgentEvents({
    onModeChange: (mode) => {
      if (mode === "chat") setActiveTab("chat");
      else if (mode === "files") setActiveTab("files");
      else if (mode === "object_detection") setActiveTab("home");
      else if (mode === "emergency") setActiveTab("emergency");
    },
    onUserTranscript: (message) => {
      addExternalUserMessage({
        id: message.id,
        sender: "user",
        text: message.text,
        timestamp: message.timestamp,
      });
    },
  });

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        height: "100%", width: "100%",
        background: "linear-gradient(135deg, #163b64 0%, #0e243d 50%, #163b64 100%)", // Nâng tông màu nền sáng và trong suốt hơn
        position: "relative", overflow: "hidden",
      }}
    >
      <style>{`
        .home-tab-container {
          flex: 1;
          display: flex;
          flex-direction: row;
          padding: 1.5rem;
          gap: 1.5rem;
          overflow: hidden;
          width: 100%;
          height: 100%;
        }

        .home-left-col {
          flex: 1.25;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 1rem;
        }

        .home-right-col {
          flex: 0.75;
          display: flex;
          flex-direction: column;
          background: rgba(15, 45, 74, 0.45);
          backdrop-filter: blur(12px);
          border: 2px solid rgba(56, 189, 248, 0.25); /* Đổi sang viền xanh dương nhẹ */
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .mini-chat-header {
          padding: 1rem;
          background: rgba(12, 30, 53, 0.85);
          border-bottom: 2px solid rgba(56, 189, 248, 0.3); /* Đổi sang viền xanh dương nhẹ */
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mini-chat-title {
          font-family: 'Atkinson Hyperlegible', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: #7dd3fc;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .mini-chat-body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mini-msg-user {
          align-self: flex-end;
          max-width: 85%;
          padding: 0.6rem 0.9rem;
          border-radius: 14px 14px 2px 14px;
          background: linear-gradient(135deg, #0ea5e9, #38bdf8);
          color: #fff;
          font-size: 0.95rem;
          line-height: 1.5;
          box-shadow: 0 4px 10px rgba(14,165,233, 0.25);
        }

        .mini-msg-agent {
          align-self: flex-start;
          max-width: 85%;
          padding: 0.6rem 0.9rem;
          border-radius: 14px 14px 14px 2px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
          color: #fff;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        @media (max-width: 1023px) {
          .home-tab-container {
            flex-direction: column;
            overflow-y: auto;
          }
          .home-left-col {
            flex: none;
            height: auto;
            aspect-ratio: 16/9;
          }
          .home-right-col {
            flex: none;
            height: 300px;
          }
        }
      `}</style>
      <div id="a11y-announcer" aria-live="assertive" className="sr-only" />

      {/* Header */}
      <StatusHeader />

      {/* Main content area */}
      <main
        style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}
        aria-label="Main content"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
          >
            {activeTab === "home" && <HomeTab unifiedMessages={unifiedMessages} />}
            {activeTab === "chat" && <ChatTab unifiedMessages={unifiedMessages} send={send} />}
            {activeTab === "files" && <FilesTab unifiedMessages={unifiedMessages} />}
            {activeTab === "emergency" && <EmergencyTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mic / Cam controls */}
      <ControlBar />

      {/* Bottom pill navbar */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}