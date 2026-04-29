"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  useLocalParticipant,
  useVoiceAssistant,
  VideoTrack,
} from "@livekit/components-react";
import { Camera, CameraOff, FileText, MessageSquareText, Mic, MicOff, Search, Send } from "lucide-react";
import { Track } from "livekit-client";
import { AgentMode, useAgentEvents } from "@/hooks/useAgentEvents";
import AudioVisualizer from "./AudioVisualizer";

type CapabilityMode = {
  id: AgentMode;
  label: string;
  description: string;
  phrases: string[];
};

const fallbackModes: CapabilityMode[] = [
  {
    id: "object_detection",
    label: "Object Detection",
    description: "Camera-first mode for asking what the assistant can see.",
    phrases: ["object detection", "detect objects", "what do you see"],
  },
  {
    id: "chat",
    label: "Chat",
    description: "Conversation mode for asking general questions.",
    phrases: ["chat", "chatbox", "ask a question"],
  },
  {
    id: "files",
    label: "Read Files",
    description: "File mode for reading or summarizing local documents.",
    phrases: ["read files", "summarize file", "read my pdf"],
  },
];

const modeIcons = {
  object_detection: Search,
  chat: MessageSquareText,
  files: FileText,
};

export default function AgentWorkspace() {
  const [mode, setMode] = useState<AgentMode>("chat");
  const [modes, setModes] = useState<CapabilityMode[]>(fallbackModes);

  const handleModeChange = useCallback((nextMode: AgentMode) => {
    setMode(nextMode);
  }, []);

  useAgentEvents({ onModeChange: handleModeChange });

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:5000";

    fetch(`${baseUrl}/api/capabilities`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (Array.isArray(data?.modes)) {
          setModes(data.modes);
        }
      })
      .catch(() => {
        setModes(fallbackModes);
      });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-3 md:p-6">
      <div id="a11y-announcer" aria-live="assertive" className="sr-only" />

      <ModeSwitcher modes={modes} activeMode={mode} onChange={setMode} />

      <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-neutral-950">
        {mode === "object_detection" && <ObjectDetectionView />}
        {mode === "chat" && <ChatView />}
        {mode === "files" && <FilesView />}
      </section>

      <MicDock />
    </div>
  );
}

function ModeSwitcher({
  modes,
  activeMode,
  onChange,
}: {
  modes: CapabilityMode[];
  activeMode: AgentMode;
  onChange: (mode: AgentMode) => void;
}) {
  return (
    <nav className="grid grid-cols-3 gap-2" aria-label="Agent modes">
      {modes.map((mode) => {
        const Icon = modeIcons[mode.id];
        const active = mode.id === activeMode;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            title={mode.phrases.join(", ")}
            className={`flex h-20 items-center justify-center gap-3 rounded-lg border px-3 text-base font-bold uppercase tracking-normal transition-colors md:text-xl ${
              active
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/[0.03] text-white hover:border-white/30"
            }`}
          >
            <Icon className="h-7 w-7 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ObjectDetectionView() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();

  const toggleCamera = async () => {
    await localParticipant?.setCameraEnabled(!isCameraEnabled);
  };

  const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);
  const trackRef =
    localParticipant && cameraPublication
      ? {
          participant: localParticipant,
          source: Track.Source.Camera,
          publication: cameraPublication,
        }
      : null;

  return (
    <div className="grid h-full min-h-[520px] grid-rows-[1fr_auto] bg-black">
      <button
        type="button"
        onClick={toggleCamera}
        aria-label={isCameraEnabled ? "Camera is on. Press to turn it off." : "Camera is off. Press to turn it on."}
        className="relative flex min-h-0 items-center justify-center overflow-hidden focus-visible:ring-4 focus-visible:ring-yellow-300"
      >
        {isCameraEnabled && trackRef ? (
          <>
            <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded bg-black/75 px-3 py-2 text-sm font-bold uppercase text-cyan-200">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
              Object Detection
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center text-white">
            <CameraOff className="h-24 w-24 text-neutral-500" aria-hidden="true" />
            <span className="text-3xl font-black uppercase">Camera Off</span>
          </div>
        )}
      </button>

      <div className="flex items-center justify-between border-t border-white/10 bg-neutral-950 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black uppercase text-white">Object Detection</h2>
          <p className="truncate text-base text-neutral-400">Ask what is visible in the camera frame.</p>
        </div>
        <button
          type="button"
          onClick={toggleCamera}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white"
          aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {isCameraEnabled ? <Camera className="h-8 w-8" /> : <CameraOff className="h-8 w-8" />}
        </button>
      </div>
    </div>
  );
}

function ChatView() {
  const { localParticipant } = useLocalParticipant();
  const { agentTranscriptions } = useVoiceAssistant();
  const [message, setMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);

  const agentLines = useMemo(
    () => agentTranscriptions.map((segment) => segment.text).filter(Boolean).slice(-6),
    [agentTranscriptions],
  );

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || !localParticipant) return;

    await localParticipant.sendText(text, { topic: "lk.chat" });
    setSentMessages((current) => [...current.slice(-5), text]);
    setMessage("");
  };

  return (
    <div className="grid h-full min-h-[520px] grid-rows-[auto_1fr_auto] bg-neutral-950">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-3xl font-black uppercase text-white">Chat</h2>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        {sentMessages.map((text, index) => (
          <div key={`${text}-${index}`} className="ml-auto max-w-[82%] rounded-lg bg-yellow-300 px-4 py-3 text-lg font-semibold text-black">
            {text}
          </div>
        ))}

        {agentLines.map((text, index) => (
          <div key={`${text}-${index}`} className="max-w-[82%] rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-lg text-white">
            {text}
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex gap-3 border-t border-white/10 p-4">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-4 text-xl text-white placeholder:text-neutral-500"
          placeholder="Ask a question"
          aria-label="Ask a question"
        />
        <button
          type="submit"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-yellow-300 text-black"
          aria-label="Send message"
        >
          <Send className="h-7 w-7" />
        </button>
      </form>
    </div>
  );
}

function FilesView() {
  const { localParticipant } = useLocalParticipant();
  const [request, setRequest] = useState("");
  const [lastRequest, setLastRequest] = useState("");

  const submitFileRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = request.trim();
    if (!text || !localParticipant) return;

    await localParticipant.sendText(text, { topic: "lk.chat" });
    setLastRequest(text);
    setRequest("");
  };

  return (
    <div className="grid h-full min-h-[520px] grid-rows-[auto_1fr_auto] bg-neutral-950">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-3xl font-black uppercase text-white">Read Files</h2>
      </div>

      <div className="grid place-items-center p-6">
        <div className="flex w-full max-w-3xl flex-col items-center gap-5 rounded-lg border border-white/10 bg-black p-8 text-center">
          <FileText className="h-24 w-24 text-emerald-300" aria-hidden="true" />
          <p className="text-2xl font-bold text-white">
            {lastRequest || "Summarize the latest PDF"}
          </p>
        </div>
      </div>

      <form onSubmit={submitFileRequest} className="flex gap-3 border-t border-white/10 p-4">
        <input
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-4 text-xl text-white placeholder:text-neutral-500"
          placeholder="Read or summarize a file"
          aria-label="Read or summarize a file"
        />
        <button
          type="submit"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-300 text-black"
          aria-label="Send file request"
        >
          <Send className="h-7 w-7" />
        </button>
      </form>
    </div>
  );
}

function MicDock() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const toggleMic = async () => {
    await localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-white/10 bg-neutral-950 p-3">
      <div className="min-h-20 overflow-hidden rounded-lg bg-black">
        <AudioVisualizer />
      </div>
      <button
        type="button"
        onClick={toggleMic}
        className={`flex h-20 w-24 items-center justify-center rounded-lg border ${
          isMicrophoneEnabled
            ? "border-emerald-300 bg-emerald-300 text-black"
            : "border-red-400/60 bg-red-950/40 text-red-200"
        }`}
        aria-label={isMicrophoneEnabled ? "Turn microphone off" : "Turn microphone on"}
      >
        {isMicrophoneEnabled ? <Mic className="h-9 w-9" /> : <MicOff className="h-9 w-9" />}
      </button>
    </div>
  );
}
