"use client";

import { useLocalParticipant, useConnectionState, VideoTrack } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { Mic, MicOff, Camera, CameraOff, PowerOff } from "lucide-react";
import { useAgentEvents } from "../hooks/useAgentEvents";

export default function AccessibleControls() {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const connectionState = useConnectionState();
  
  // Kích hoạt hook lắng nghe dữ liệu từ Agent Python
  useAgentEvents();

  const toggleMic = async () => {
    if (localParticipant) {
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const toggleCam = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    }
  };

  const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);
  const trackRef = localParticipant && cameraPublication ? {
    participant: localParticipant,
    source: Track.Source.Camera,
    publication: cameraPublication
  } : null;

  return (
    <div className="flex flex-col h-full w-full bg-black" aria-hidden="false">
      {/* Vùng vô hình cho aria-live đọc Screen Reader mỗi khi có biến đổi quan trọng */}
      <div id="a11y-announcer" aria-live="assertive" className="sr-only"></div>

      <div className="flex-1 flex flex-col p-6 space-y-6">
          <button
              onClick={toggleMic}
              aria-label={isMicrophoneEnabled ? "Microphone đang bật. Nhấn để Tắt." : "Microphone đang tắt. Nhấn để Bật."}
              className={`flex-1 flex flex-col items-center justify-center rounded-[3rem] border-8 transition-colors z-10 ${
                  isMicrophoneEnabled
                      ? "bg-green-900 border-green-400 text-white shadow-[0_0_30px_inset_rgba(0,255,0,0.5)]"
                      : "bg-[#2a0000] border-red-500 text-yellow-300 shadow-[0_0_30px_inset_rgba(255,0,0,0.5)]"
              }`}
          >
              {isMicrophoneEnabled ? (
                  <Mic className="w-40 h-40 mb-6" aria-hidden="true" />
              ) : (
                  <MicOff className="w-40 h-40 mb-6" aria-hidden="true" />
              )}
              <span className="text-5xl font-black uppercase text-center w-full">
                  {isMicrophoneEnabled ? "Đang Nghe Bạn Nói" : "Nhấn Để Nói"}
              </span>
          </button>

          <button
              onClick={toggleCam}
              aria-label={isCameraEnabled ? "Camera đang bật. Trợ lý đang xem được bạn. Nhấn để Tắt." : "Camera đang tắt. Nhấn để Bật ống kính."}
              className={`h-1/3 flex items-center justify-center rounded-[2rem] border-8 transition-colors p-4 relative overflow-hidden z-10 ${
                  isCameraEnabled
                      ? "bg-black border-blue-400 text-white"
                      : "bg-gray-900 border-gray-600 text-gray-400"
              }`}
          >
              {isCameraEnabled ? (
                  <>
                      {trackRef && (
                          <div className="absolute inset-0 z-0">
                              <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
                          </div>
                      )}
                      {/* Viền/Icon nhỏ trong suốt để biểu thị đây là khu vực Camera nếu có người nhìn */}
                      <div className="absolute bottom-4 right-4 bg-black/60 rounded-full p-3 z-10">
                          <Camera className="w-8 h-8 text-white" aria-hidden="true" />
                      </div>
                  </>
              ) : (
                  <div className="relative z-10 flex items-center justify-center w-full">
                      <CameraOff className="w-24 h-24 mr-6" aria-hidden="true" />
                      <span className="text-4xl font-extrabold uppercase drop-shadow-lg">
                          Nhấn Để AI Nhìn Thấy
                      </span>
                  </div>
              )}
          </button>
      </div>
    </div>
  );
}
