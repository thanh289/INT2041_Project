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
  Upload
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Track } from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";

type TabId = "home" | "chat" | "files" | "emergency";

// --- 1. HEADER (Status Bar) ---
function TactileHeader() {
  const remoteParticipants = useRemoteParticipants();
  const agentParticipant = remoteParticipants.length > 0 ? remoteParticipants[0] : null;

  return (
    <header
      className="w-full h-24 md:h-32 bg-black border-b-[6px] border-white/20 flex flex-col items-center justify-center px-6 z-20 shrink-0 transition-all"
      role="region"
      aria-label="Status Bar"
    >
      <h2
        className={`text-4xl md:text-6xl font-black tracking-widest uppercase transition-colors duration-500 text-center ${agentParticipant ? 'text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]'
          }`}
        aria-live="polite"
      >
        {agentParticipant ? "AGENT CONNECTED" : "WAITING FOR AGENT..."}
      </h2>
    </header>
  );
}

// --- TAB NAVIGATION ---
function TabNavigation({ activeTab, setActiveTab }: { activeTab: TabId, setActiveTab: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "home", label: "Home / Voice", icon: Home },
    { id: "chat", label: "AI Chat", icon: MessageSquareText },
    { id: "files", label: "File Reader", icon: FileText },
    { id: "emergency", label: "Emergency", icon: AlertTriangle },
  ];

  return (
    <nav className="flex w-full bg-black border-b-[4px] border-white/20 p-4 gap-4 overflow-x-auto shrink-0 z-20" aria-label="Main Navigation">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-label={`Tab: ${tab.label}`}
            className={`relative flex-1 min-w-[200px] h-24 md:h-32 flex flex-col items-center justify-center gap-2 rounded-[1.5rem] border-[4px] transition-all duration-300 group ${isActive
              ? "bg-yellow-400 border-yellow-500 text-black shadow-[0_0_30px_rgba(250,204,21,0.4)]"
              : "bg-[#111] border-gray-700 text-white hover:bg-[#222] hover:border-gray-500 hover:scale-[1.02]"
              }`}
          >
            <Icon className={`h-10 w-10 md:h-12 md:w-12 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`} aria-hidden="true" />
            <span className="text-xl md:text-2xl font-black uppercase tracking-wider">{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-[-10px] w-[80%] h-[8px] bg-white rounded-full shadow-[0_0_20px_white]"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// --- HOME/VOICE TAB (Vision & Audio) ---
function HomeTab() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();

  const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);
  const trackRef = localParticipant && cameraPublication ? {
    participant: localParticipant,
    source: Track.Source.Camera,
    publication: cameraPublication,
  } : null;

  return (
    <div className="flex-1 w-full h-full p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Massive Audio Visualizer Base */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-500 flex items-center justify-center ${isCameraEnabled ? 'opacity-30 scale-90' : 'opacity-100 scale-100'
        }`}>
        <AudioVisualizer />
      </div>

      {/* Camera Feed Card */}
      <div className="z-10 w-full max-w-5xl aspect-video relative flex items-center justify-center pointer-events-none">
        {isCameraEnabled && trackRef ? (
          <div className="w-full h-full rounded-[3rem] overflow-hidden border-[8px] border-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.5)] bg-black">
            <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full bg-black/80 backdrop-blur-xl rounded-[3rem] border-[6px] border-white/20 shadow-2xl">
            <CameraOff className="h-40 w-40 text-gray-500 mb-8" aria-hidden="true" />
            <span className="text-5xl md:text-7xl font-black text-gray-400 uppercase tracking-wider">Camera Off</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- AI CHAT TAB ---
function ChatTab() {
  const { localParticipant } = useLocalParticipant();
  const { agentTranscriptions } = useVoiceAssistant();
  const [message, setMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentLines = useMemo(
    () => agentTranscriptions.map((segment) => segment.text).filter(Boolean),
    [agentTranscriptions],
  );

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || !localParticipant) return;

    await localParticipant.sendText(text, { topic: "chat" });
    setSentMessages((current) => [...current, text]);
    setMessage("");
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  return (
    <div className="flex flex-col w-full h-full max-w-5xl mx-auto p-6">

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-8 flex flex-col bg-[#0a0a0a] rounded-[2rem] border-[4px] border-white/20 p-8 shadow-inner mb-6"
        role="log"
        aria-live="polite"
      >
        {sentMessages.length === 0 && agentLines.length === 0 && (
          <div className="m-auto text-3xl text-gray-500 font-bold uppercase tracking-widest">No messages yet</div>
        )}

        {sentMessages.map((text, index) => (
          <div key={`user-${index}`} className="ml-auto min-w-[50%] max-w-[90%] rounded-3xl bg-[#111] p-8 border-[4px] border-gray-600 shadow-xl">
            <span className="block text-2xl font-black text-gray-400 mb-3 uppercase tracking-wider">You</span>
            <p className="text-4xl text-white font-bold leading-snug">{text}</p>
          </div>
        ))}

        {agentLines.map((text, index) => (
          <div key={`agent-${index}`} className="mr-auto min-w-[50%] max-w-[90%] rounded-3xl bg-yellow-400 p-8 border-[6px] border-yellow-500 shadow-[0_10px_40px_rgba(250,204,21,0.4)] text-black">
            <span className="block text-2xl font-black mb-3 uppercase tracking-wider text-yellow-900">Assistant</span>
            <p className="text-4xl text-black font-extrabold leading-snug">{text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex gap-4 md:gap-6 shrink-0">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="flex-1 rounded-[2rem] bg-[#111] border-[6px] border-white/30 px-10 py-6 text-4xl text-white font-bold placeholder:text-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-[10px] focus:ring-cyan-400/50 transition-all shadow-2xl"
          placeholder="Type your message..."
          aria-label="Text input to chat with AI"
        />
        <button
          type="submit"
          className="flex items-center justify-center rounded-[2rem] bg-cyan-400 text-black px-10 py-6 font-black transition-all hover:scale-[1.03] hover:bg-cyan-300 active:scale-95 border-b-[10px] border-cyan-600 hover:border-cyan-500 min-w-[200px]"
          aria-label="Send Message"
        >
          <Send className="h-12 w-12 md:mr-4" />
          <span className="hidden md:inline text-4xl tracking-widest uppercase">Send</span>
        </button>
      </form>
    </div>
  );
}

// --- FILE ASSISTANT TAB ---
function FilesTab() {
  const { localParticipant } = useLocalParticipant();
  const [status, setStatus] = useState<string>("Ready to upload");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !localParticipant) return;

    setStatus(`Processing: ${file.name}...`);
    // Placeholder logic - actual parsing logic needed based on file type
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const textContent = `File Uploaded: ${file.name}. Asking AI to summarize...`;
        await localParticipant.sendText(textContent, { topic: "chat" });
        setStatus(`Sent to AI: ${file.name}`);
      } catch (err) {
        console.error(err);
        setStatus("Error sending file data to AI.");
      }
    };
    reader.readAsText(file); // Only works for plain text. Real PDFs require parsing.
  };

  return (
    <div className="flex w-full h-full p-6 items-center justify-center">
      <div className="w-full max-w-4xl bg-[#0a0a0a] rounded-[3rem] border-[6px] border-white/20 p-12 shadow-2xl flex flex-col items-center text-center">
        <FileText className="h-40 w-40 text-emerald-400 mb-8" />
        <h3 className="text-5xl font-black text-white uppercase tracking-wider mb-6">File Assistant</h3>
        <p className="text-3xl text-gray-400 font-bold mb-12">Upload a text file or PDF to have the Assistant read and summarize it.</p>

        <label
          className="w-full flex-col flex items-center justify-center p-16 rounded-[2rem] border-[8px] border-dashed border-emerald-500/50 hover:border-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/30 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          tabIndex={0}
          role="button"
          aria-label="Upload file to read"
        >
          <Upload className="h-24 w-24 text-emerald-400 mb-6" />
          <span className="text-4xl font-black text-emerald-400 uppercase tracking-widest">{status}</span>
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.json,.csv" // Expanding later to PDF/DOCX
            onChange={handleFileUpload}
          />
        </label>
      </div>
    </div>
  );
}

// --- EMERGENCY TAB ---
function EmergencyTab() {
  return (
    <div className="flex w-full h-full p-6 items-center justify-center">
      <div className="w-full max-w-4xl bg-red-950/30 rounded-[3rem] border-[8px] border-red-500 p-12 shadow-[0_0_80px_rgba(239,68,68,0.4)] flex flex-col items-center text-center">
        <AlertTriangle className="h-48 w-48 text-red-500 mb-10 animate-pulse" />
        <h3 className="text-6xl font-black text-white uppercase tracking-wider mb-8 drop-shadow-md">Rescue Mode</h3>
        <p className="text-4xl text-red-200 font-bold mb-12 leading-tight">Instantly gather location and alert emergency contacts.</p>

        <button
          className="w-full bg-red-600 hover:bg-red-500 text-white rounded-[2rem] border-b-[12px] border-red-800 p-10 transition-all duration-300 hover:scale-[1.05] active:scale-95 shadow-2xl"
          aria-label="Trigger SOS Alert"
          onClick={() => {
            const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...");
            beep.play().catch(e => { });
            alert("SOS TRIGGERED! (Placeholder for actual SOS logic)");
          }}
        >
          <span className="text-6xl font-black uppercase tracking-widest drop-shadow-lg">SEND SOS</span>
        </button>
      </div>
    </div>
  );
}


// --- FOOTER (Control Bar) ---
function TactileFooter() {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMic = async () => {
    await localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleCamera = async () => {
    await localParticipant?.setCameraEnabled(!isCameraEnabled);
  };

  return (
    <footer
      className="w-full bg-black border-t-[6px] border-white/20 p-6 flex flex-wrap items-center justify-center gap-6 shrink-0 z-20"
      role="region"
      aria-label="Global Controls"
    >
      <button
        onClick={toggleMic}
        className={`flex min-h-[120px] flex-1 max-w-[400px] items-center justify-center gap-6 rounded-[2rem] border-[6px] transition-all duration-300 ${isMicrophoneEnabled
          ? "border-yellow-400 bg-yellow-400 text-black shadow-[0_0_50px_rgba(250,204,21,0.5)] border-b-[12px] border-b-yellow-600 hover:bg-yellow-300"
          : "border-gray-600 bg-[#1a0505] text-red-500 border-b-[12px] border-b-gray-800 hover:bg-[#2a0808]"
          } hover:scale-[1.04] active:scale-95`}
        aria-label={isMicrophoneEnabled ? "Microphone ON. Tap to mute." : "Microphone OFF. Tap to unmute."}
      >
        {isMicrophoneEnabled ? <Mic className="h-16 w-16 md:h-20 md:w-20" aria-hidden="true" /> : <MicOff className="h-16 w-16 md:h-20 md:w-20" aria-hidden="true" />}
        <span className="text-4xl md:text-5xl font-black uppercase tracking-widest">{isMicrophoneEnabled ? "Mic On" : "Mic Off"}</span>
      </button>

      <button
        onClick={toggleCamera}
        className={`flex min-h-[120px] flex-1 max-w-[400px] items-center justify-center gap-6 rounded-[2rem] border-[6px] transition-all duration-300 ${isCameraEnabled
          ? "border-cyan-400 bg-cyan-400 text-black shadow-[0_0_50px_rgba(34,211,238,0.5)] border-b-[12px] border-b-cyan-600 hover:bg-cyan-300"
          : "border-gray-600 bg-[#05101a] text-cyan-500 border-b-[12px] border-b-gray-800 hover:bg-[#081a2a]"
          } hover:scale-[1.04] active:scale-95`}
        aria-label={isCameraEnabled ? "Camera ON. Tap to turn off." : "Camera OFF. Tap to turn on."}
      >
        {isCameraEnabled ? <Camera className="h-16 w-16 md:h-20 md:w-20" aria-hidden="true" /> : <CameraOff className="h-16 w-16 md:h-20 md:w-20" aria-hidden="true" />}
        <span className="text-4xl md:text-5xl font-black uppercase tracking-widest">{isCameraEnabled ? "Cam On" : "Cam Off"}</span>
      </button>
    </footer>
  );
}

// --- MAIN WORKSPACE ---
export default function AgentWorkspace() {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  return (
    <div className="flex flex-col h-full w-full bg-black relative">
      <div id="a11y-announcer" aria-live="assertive" className="sr-only" />

      {/* Layer 1: Header */}
      <TactileHeader />

      {/* Layer 2: Tabs */}
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Layer 3: Dynamic Main Content Area */}
      <main className="flex-1 w-full relative overflow-hidden flex flex-col bg-[#050505]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 w-full h-full flex flex-col"
          >
            {activeTab === "home" && <HomeTab />}
            {activeTab === "chat" && <ChatTab />}
            {activeTab === "files" && <FilesTab />}
            {activeTab === "emergency" && <EmergencyTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Layer 4: Global Controls (Always visible) */}
      <TactileFooter />

    </div>
  );
}