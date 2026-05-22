"use client";

import { useLocalParticipant, useConnectionState, VideoTrack } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { Mic, MicOff, Camera, CameraOff, PowerOff } from "lucide-react";
import { useAgentEvents } from "../hooks/useAgentEvents";

export default function AccessibleControls() {
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
    const connectionState = useConnectionState();

    // Kích hoạt hook lắng nghe dữ liệu từ Agent Python
    //   useAgentEvents();

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
        <div className="flex flex-col h-full w-full bg-transparent" aria-hidden="false">
            {/* Vùng vô hình cho aria-live đọc Screen Reader mỗi khi có biến đổi quan trọng */}
            <div id="a11y-announcer" aria-live="assertive" className="sr-only"></div>

            <div className="flex-1 flex flex-col p-4 lg:p-8 space-y-6 lg:space-y-8">

                {/* CAMERA FEED - Middle Section */}
                <button
                    onClick={toggleCam}
                    aria-label={isCameraEnabled ? "Camera is ON. Assistant can see you. Tap to turn OFF." : "Camera is OFF. Tap to turn ON."}
                    className={`flex-1 min-h-[30vh] flex items-center justify-center rounded-[2rem] border-4 transition-all duration-500 overflow-hidden relative group focus-within:ring-4 focus-within:ring-yellow-400 ${isCameraEnabled
                        ? "bg-gradient-to-br from-[#0ea5e9] via-[#38bdf8] to-[#0284c7] border-white shadow-[0_0_40px_rgba(34,211,238,0.4)]"
                        : "bg-red-500/10 border-red-500/30 backdrop-blur-md hover:bg-red-500/20"
                        }`}
                >
                    {isCameraEnabled ? (
                        <>
                            {trackRef && (
                                <div className="absolute inset-0 z-0">
                                    <VideoTrack trackRef={trackRef} className="w-full h-full object-cover opacity-90" />
                                </div>
                            )}

                            {/* Cyberpunk style overlay HUD */}
                            <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/50 z-10">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-white text-sm font-bold tracking-widest">VISION ACTIVE</span>
                            </div>

                            <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-xl border border-white/30 rounded-full p-4 z-10 group-hover:scale-110 transition-transform">
                                <Camera className="w-8 h-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" aria-hidden="true" />
                            </div>

                            {/* Cyberpunk corner accents */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white z-10 rounded-tl-[2rem] opacity-80" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white z-10 rounded-tr-[2rem] opacity-80" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white z-10 rounded-bl-[2rem] opacity-80" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white z-10 rounded-br-[2rem] opacity-80" />
                        </>
                    ) : (
                        <div className="relative z-10 flex flex-col items-center justify-center w-full">
                            <CameraOff className="w-20 h-20 mb-4 text-red-400 transition-colors group-hover:text-red-300" aria-hidden="true" />
                            <span className="text-2xl font-extrabold tracking-widest text-red-400 transition-colors group-hover:text-red-300">
                                ENABLE VISION
                            </span>
                        </div>
                    )}
                </button>

                {/* MAIN MIC BUTTON - Bottom Control Bar */}
                <button
                    onClick={toggleMic}
                    aria-label={isMicrophoneEnabled ? "Microphone is ON. Tap to turn OFF." : "Microphone is OFF. Tap to turn ON."}
                    className={`h-[25vh] min-h-[200px] flex items-center justify-center rounded-[3rem] border-4 transition-all duration-500 z-10 focus-within:ring-4 focus-within:ring-yellow-400 ${isMicrophoneEnabled
                        ? "bg-gradient-to-br from-[#0ea5e9] via-[#38bdf8] to-[#0284c7] border-white shadow-[0_0_50px_rgba(14,165,233,0.4),inset_0_0_20px_rgba(255,255,255,0.2)]"
                        : "bg-red-500/10 border-red-500/30 backdrop-blur-xl glassmorphism hover:bg-red-500/20 shadow-[0_0_30px_inset_rgba(239,68,68,0.1)]"
                        }`}
                >
                    <div className="flex flex-col items-center justify-center w-full h-full">
                        {isMicrophoneEnabled ? (
                            <div className="relative">
                                <div className="absolute inset-0 bg-white rounded-full blur-xl opacity-40 animate-pulse" />
                                <Mic className="relative w-24 h-24 mb-6 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" aria-hidden="true" />
                            </div>
                        ) : (
                            <MicOff className="w-24 h-24 mb-6 text-red-400 opacity-90" aria-hidden="true" />
                        )}
                        <span className={`text-4xl font-black uppercase tracking-widest text-center w-full transition-colors drop-shadow-md ${isMicrophoneEnabled ? "text-white" : "text-red-400 opacity-90"
                            }`}>
                            {isMicrophoneEnabled ? "LISTENING" : "TAP TO SPEAK"}
                        </span>
                    </div>
                </button>

            </div>
        </div>
    );
}
