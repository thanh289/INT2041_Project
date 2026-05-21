"use client";

import { FormEvent, useMemo, useState, useRef } from "react";
import {
  useLocalParticipant,
  useVoiceAssistant,
  VideoTrack,
  useRemoteParticipants,
} from "@livekit/components-react";
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
import { Track } from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";
import { useAgentEvents } from "../hooks/useAgentEvents";

type TabId = "home" | "chat" | "files" | "emergency";

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
      aria-label="Trạng thái kết nối"
      style={{
        background: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 100%)",
        borderBottom: "3px solid rgba(9,141,113,0.4)",
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
          background: "linear-gradient(135deg, var(--color-primary), #38bdf8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(9,141,113,0.5)",
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
          background: isConnected ? "rgba(9,141,113,0.2)" : "rgba(255,255,255,0.08)",
          border: `2px solid ${isConnected ? "var(--color-primary)" : "rgba(255,255,255,0.2)"}`,
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
        {isConnected ? "Đã kết nối" : "Đang chờ..."}
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
      background: "rgba(30,61,51,0.95)",
      borderTop: "2px solid rgba(9,141,113,0.3)",
      flexShrink: 0,
      zIndex: 20,
    }}
      role="region"
      aria-label="Điều khiển mic và camera"
    >
      {/* Mic button */}
      <button
        onClick={toggleMic}
        aria-label={isMicrophoneEnabled ? "Microphone đang bật. Nhấn để tắt." : "Microphone đang tắt. Nhấn để bật."}
        style={{
          flex: 1,
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          borderRadius: 16,
          border: `3px solid ${isMicrophoneEnabled ? "var(--color-primary)" : "rgba(239,68,68,0.5)"}`,
          background: isMicrophoneEnabled
            ? "linear-gradient(135deg, rgba(9,141,113,0.25), rgba(9,141,113,0.12))"
            : "rgba(239,68,68,0.08)",
          color: isMicrophoneEnabled ? "#7dd3fc" : "#f87171",
          cursor: "pointer",
          transition: "all 0.2s ease",
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          boxShadow: isMicrophoneEnabled ? "0 4px 16px rgba(9,141,113,0.3)" : "none",
        }}
      >
        {isMicrophoneEnabled
          ? <Mic size={28} aria-hidden="true" />
          : <MicOff size={28} aria-hidden="true" />}
        <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {isMicrophoneEnabled ? "Mic bật" : "Mic tắt"}
        </span>
      </button>

      {/* Camera button */}
      <button
        onClick={toggleCam}
        aria-label={isCameraEnabled ? "Camera đang bật. Nhấn để tắt." : "Camera đang tắt. Nhấn để bật."}
        style={{
          flex: 1,
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          borderRadius: 16,
          border: `3px solid ${isCameraEnabled ? "var(--color-primary)" : "rgba(255,255,255,0.15)"}`,
          background: isCameraEnabled
            ? "linear-gradient(135deg, rgba(9,141,113,0.25), rgba(9,141,113,0.12))"
            : "rgba(255,255,255,0.04)",
          color: isCameraEnabled ? "#34d399" : "rgba(255,255,255,0.45)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          boxShadow: isCameraEnabled ? "0 4px 16px rgba(9,141,113,0.3)" : "none",
        }}
      >
        {isCameraEnabled
          ? <Camera size={28} aria-hidden="true" />
          : <CameraOff size={28} aria-hidden="true" />}
        <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {isCameraEnabled ? "Camera bật" : "Camera tắt"}
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
      aria-label="Điều hướng chính"
      style={{
        position: "relative",
        zIndex: 30,
        padding: "0 1rem 1.25rem",
        background: "transparent",
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 100%)",
        borderTop: "3px solid rgba(9,141,113,0.3)",
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
                    : "linear-gradient(135deg, var(--color-primary), #38bdf8)"
                  : "transparent",
                color: isActive ? "#fff" : isEmergency ? "#f87171" : "rgba(255,255,255,0.55)",
                boxShadow: isActive
                  ? isEmergency
                    ? "0 6px 20px rgba(220,38,38,0.5)"
                    : "0 6px 20px rgba(9,141,113,0.5)"
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
function HomeTab() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);
  const trackRef = localParticipant && cameraPublication
    ? { participant: localParticipant, source: Track.Source.Camera, publication: cameraPublication }
    : null;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "1rem", gap: "1rem", overflow: "hidden",
      position: "relative",
    }}>
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
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 720,
        borderRadius: 24,
        overflow: "hidden",
        border: `3px solid ${isCameraEnabled ? "var(--color-primary)" : "rgba(255,255,255,0.1)"}`,
        boxShadow: isCameraEnabled ? "0 0 40px rgba(9,141,113,0.35)" : "none",
        background: "#0a1a14",
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
              border: "1.5px solid rgba(9,141,113,0.5)",
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
            <CameraOff size={64} color="rgba(255,255,255,0.25)" aria-hidden="true" />
            <span style={{
              fontSize: "1.1rem", fontWeight: 700, color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.1em", textTransform: "uppercase",
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
            }}>
              Camera đang tắt
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CHAT TAB
// ─────────────────────────────────────────
function ChatTab() {
  const { localParticipant } = useLocalParticipant();
  const { agentTranscriptions } = useVoiceAssistant();
  const [message, setMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentLines = useMemo(
    () => agentTranscriptions.map((s) => s.text).filter(Boolean),
    [agentTranscriptions]
  );

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || !localParticipant) return;
    await localParticipant.sendText(text, { topic: "lk.chat" });
    setSentMessages((prev) => [...prev, text]);
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
        aria-label="Lịch sử trò chuyện"
        style={{
          flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
          gap: "0.75rem", padding: "1rem",
          background: "rgba(0,0,0,0.25)",
          borderRadius: 20,
          border: "2px solid rgba(9,141,113,0.2)",
        }}
      >
        {sentMessages.length === 0 && agentLines.length === 0 && (
          <div style={{
            margin: "auto", textAlign: "center",
            color: "rgba(255,255,255,0.3)", fontWeight: 700,
            fontSize: "1rem", letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
          }}>
            Chưa có tin nhắn
          </div>
        )}

        {sentMessages.map((text, i) => (
          <div key={`u-${i}`} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{
              maxWidth: "80%", padding: "0.75rem 1.1rem",
              borderRadius: "18px 18px 4px 18px",
              background: "linear-gradient(135deg, var(--color-primary), #38bdf8)",
              boxShadow: "0 4px 12px rgba(9,141,113,0.35)",
              color: "#fff",
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
              fontSize: "1rem", lineHeight: 1.6,
            }}>
              {text}
            </div>
          </div>
        ))}

        {agentLines.map((text, i) => (
          <div key={`a-${i}`} style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "0.75rem 1.1rem",
              borderRadius: "18px 18px 18px 4px",
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(9,141,113,0.3)",
              color: "#fff",
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
              fontSize: "1rem", lineHeight: 1.6,
            }}>
              <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#7dd3fc", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Trợ lý
              </span>
              {text}
            </div>
          </div>
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
          placeholder="Nhập tin nhắn..."
          aria-label="Nhập tin nhắn để chat với AI"
          style={{
            flex: 1, padding: "0.875rem 1.25rem",
            borderRadius: 14,
            background: "rgba(255,255,255,0.07)",
            border: "2px solid rgba(9,141,113,0.35)",
            color: "#fff",
            fontSize: "1rem",
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(9,141,113,0.35)")}
        />
        <button
          type="submit"
          aria-label="Gửi tin nhắn"
          style={{
            padding: "0 1.25rem",
            borderRadius: 14,
            background: "linear-gradient(135deg, var(--color-primary), #38bdf8)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(9,141,113,0.4)",
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
function FilesTab() {
  const { localParticipant } = useLocalParticipant();
  const [status, setStatus] = useState("Sẵn sàng nhận file");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localParticipant) return;
    setStatus(`Đang xử lý: ${file.name}...`);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await localParticipant.sendText(`File đã tải lên: ${file.name}. Tóm tắt nội dung giúp tôi.`, { topic: "lk.chat" });
        setStatus(`Đã gửi: ${file.name}`);
      } catch {
        setStatus("Lỗi khi gửi file đến AI.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        width: "100%", maxWidth: 560,
        background: "rgba(0,0,0,0.2)",
        border: "3px solid rgba(9,141,113,0.35)",
        borderRadius: 24,
        padding: "2rem 1.5rem",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem",
        textAlign: "center",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(9,141,113,0.15)",
          border: "3px solid rgba(9,141,113,0.4)",
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
            Trợ lý đọc file
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            Tải lên file văn bản để AI đọc và tóm tắt nội dung cho bạn.
          </p>
        </div>

        <label
          tabIndex={0}
          role="button"
          aria-label="Tải file lên để đọc"
          style={{
            width: "100%", minHeight: 140,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "0.75rem",
            borderRadius: 18,
            border: "3px dashed rgba(9,141,113,0.5)",
            background: "rgba(9,141,113,0.06)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            padding: "1.5rem",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget.style.background = "rgba(9,141,113,0.12)");
            (e.currentTarget.style.borderColor = "var(--color-primary)");
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.style.background = "rgba(9,141,113,0.06)");
            (e.currentTarget.style.borderColor = "rgba(9,141,113,0.5)");
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
            accept=".txt,.md,.json,.csv"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </label>
      </div>
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
      alert("Chưa kết nối với trợ lý.");
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
      alert("SOS đã được gửi. Đang thông báo người liên hệ khẩn cấp.");
    } catch {
      alert("Gửi SOS thất bại. Vui lòng thử lại.");
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
            Khẩn cấp SOS
          </h2>
          <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            Nhấn nút bên dưới để gửi vị trí và thông báo khẩn cấp.
          </p>
        </div>

        <button
          onClick={triggerSos}
          aria-label="Gửi tín hiệu SOS ngay bây giờ"
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
          GỬI SOS
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

  useAgentEvents({
    onModeChange: (mode) => {
      if (mode === "chat") setActiveTab("chat");
      else if (mode === "files") setActiveTab("files");
      else if (mode === "object_detection") setActiveTab("home");
    },
  });

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        height: "100%", width: "100%",
        background: "linear-gradient(135deg, #0f2d4a 0%, #0c1e35 60%, #0f2d4a 100%)",
        position: "relative", overflow: "hidden",
      }}
    >
      <div id="a11y-announcer" aria-live="assertive" className="sr-only" />

      {/* Header */}
      <StatusHeader />

      {/* Main content area */}
      <main
        style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}
        aria-label="Nội dung chính"
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
            {activeTab === "home" && <HomeTab />}
            {activeTab === "chat" && <ChatTab />}
            {activeTab === "files" && <FilesTab />}
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