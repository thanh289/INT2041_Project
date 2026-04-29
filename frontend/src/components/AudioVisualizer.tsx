"use client";

import { useMemo } from "react";
import { Track } from "livekit-client";
import { useRemoteParticipants, BarVisualizer } from "@livekit/components-react";

export default function AudioVisualizer() {
  const remoteParticipants = useRemoteParticipants();
  const agentParticipant = remoteParticipants.length > 0 ? remoteParticipants[0] : null;

  const agentMicPublication = agentParticipant?.getTrackPublication(Track.Source.Microphone);

  const agentTrackRef = useMemo(() => {
    return agentParticipant && agentMicPublication
      ? {
          participant: agentParticipant,
          publication: agentMicPublication,
          source: Track.Source.Microphone,
        }
      : undefined;
  }, [agentParticipant, agentMicPublication]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent">
      {/* Khung chứa sóng âm được thiết kế tối giản, hiện đại */}
      <div className="w-full h-full relative flex flex-col items-center justify-center p-8">
        
        {/* Chỉ hiện sóng âm khi Agent thực sự tồn tại */}
        {agentTrackRef ? (
          <div className="w-full h-64 flex flex-col items-center justify-center">
             {/* Hiệu ứng text chạy nhẹ nhàng dưới sóng âm */}
            <span className="text-cyan-400/60 text-xs font-bold tracking-[0.5em] mb-8 animate-pulse uppercase">
              Signal Processing
            </span>
            
            <div className="w-full max-w-4xl h-40 text-cyan-400 filter drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              <BarVisualizer
                state="listening"
                barCount={15}
                options={{ minHeight: 20 }}
                trackRef={agentTrackRef}
                className="w-full h-full"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 opacity-40">
            <div className="w-12 h-12 border-4 border-gray-600 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-gray-500 font-bold tracking-widest text-sm">SYNCHRONIZING...</span>
          </div>
        )}

        {/* Badge nhỏ báo hiệu trạng thái Live ở góc dưới */}
        {agentParticipant && (
          <div className="mt-8 flex items-center space-x-2 px-3 py-1 bg-cyan-500/5 border border-cyan-500/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-[10px] text-cyan-500/80 font-bold tracking-tighter uppercase">AI Stream</span>
          </div>
        )}
      </div>
    </div>
  );
}