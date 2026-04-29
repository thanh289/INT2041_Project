import { useEffect } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";

export type AgentMode = "object_detection" | "chat" | "files";

type UseAgentEventsOptions = {
  onModeChange?: (mode: AgentMode) => void;
};

function isAgentMode(value: unknown): value is AgentMode {
  return value === "object_detection" || value === "chat" || value === "files";
}

export function useAgentEvents({ onModeChange }: UseAgentEventsOptions = {}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const strData = new TextDecoder().decode(payload);
        const data = JSON.parse(strData);

        if (data.type === "set_ui_mode" && isAgentMode(data.mode)) {
          onModeChange?.(data.mode);
          announceToScreenReader(`Switched to ${data.mode.replace("_", " ")} mode`);

          if (data.mode === "object_detection" && localParticipant) {
            localParticipant.setCameraEnabled(true);
          }
          return;
        }

        if (typeof data.type === "string" && data.type.startsWith("control_")) {
          const target = data.type.replace("control_", "");
          const status = data.status === "on" ? "on" : "off";

          if (!localParticipant) return;

          if (target === "microphone") {
            localParticipant.setMicrophoneEnabled(status === "on");
            announceToScreenReader(`Microphone ${status}`);
          } else if (target === "camera") {
            localParticipant.setCameraEnabled(status === "on");
            announceToScreenReader(`Camera ${status}`);
          } else if (target === "chat") {
            onModeChange?.(status === "on" ? "chat" : "object_detection");
            announceToScreenReader(status === "on" ? "Switched to chat mode" : "Closed chat mode");
          }
        }
      } catch (err) {
        console.error("Failed to parse agent data event:", err);
      }
    };

    room.on("dataReceived", handleDataReceived);
    return () => {
      room.off("dataReceived", handleDataReceived);
    };
  }, [room, localParticipant, onModeChange]);
}

function announceToScreenReader(message: string) {
  const el = document.getElementById("a11y-announcer");
  if (!el) return;

  el.textContent = "";
  setTimeout(() => {
    el.textContent = message;
  }, 50);
}
