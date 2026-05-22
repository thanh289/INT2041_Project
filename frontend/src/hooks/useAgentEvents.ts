import { useEffect } from "react";
import { ConnectionState } from "livekit-client";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";

export type AgentMode = "object_detection" | "chat" | "files" | "emergency";

type UseAgentEventsOptions = {
  onModeChange?: (mode: AgentMode) => void;
};

function isAgentMode(value: unknown): value is AgentMode {
  return value === "object_detection" || value === "chat" || value === "files" || value === "emergency";
}

export function useAgentEvents({ onModeChange }: UseAgentEventsOptions = {}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // --- PHẦN SỬA LỖI: GỬI TỌA ĐỘ SANG BACKEND AN TOÀN ---
  useEffect(() => {
    // Chỉ thực hiện khi đã có participant, phòng đã kết nối hoàn toàn
    if (localParticipant && room.state === ConnectionState.Connected) {
      let cancelled = false;

      const sendLocation = async () => {
        // Chờ cho đến khi có tọa độ trong localStorage và agent backend đã vào room.
        for (let attempt = 0; attempt < 20 && !cancelled; attempt += 1) {
          const coordsStr = localStorage.getItem("user_coords");
          const agentReady = room.remoteParticipants.size > 0;

          if (!coordsStr || !agentReady) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          try {
            const payload = {
              type: "location_update",
              data: JSON.parse(coordsStr),
            };
            const encoder = new TextEncoder();

            if (room.state === ConnectionState.Connected) {
              await localParticipant.publishData(
                encoder.encode(JSON.stringify(payload)),
                { reliable: true }
              );
              console.log("🚀 [Location] Đồng bộ tọa độ sang Backend thành công.");
            }
          } catch (err) {
            console.error("❌ [Location] Gửi data tọa độ thất bại:", err);
          }

          return;
        }
      };

      sendLocation();

      return () => {
        cancelled = true;
      };
    }
  }, [localParticipant, room.state, room]);
  // ----------------------------------------------------

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const strData = new TextDecoder().decode(payload);
        const data = JSON.parse(strData);

        // Xử lý chuyển đổi UI Mode từ Agent
        if (data.type === "set_ui_mode" && isAgentMode(data.mode)) {
          onModeChange?.(data.mode);
          announceToScreenReader(`Switched to ${data.mode.replace("_", " ")} mode`);

          if (data.mode === "object_detection" && localParticipant) {
            localParticipant.setCameraEnabled(true);
          }
          return;
        }

        // Xử lý các lệnh điều khiển (Microphone, Camera, Chat) từ Agent
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