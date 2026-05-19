"use client";

import { useMemo } from "react";
import { BarVisualizer, useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";

export default function AudioVisualizer() {
  const remoteParticipants = useRemoteParticipants();
  const agentParticipant = remoteParticipants[0] ?? null;
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
    <div className="flex h-full w-full items-center justify-center px-4">
      {agentTrackRef ? (
        <BarVisualizer
          state="listening"
          barCount={18}
          options={{ minHeight: 12 }}
          trackRef={agentTrackRef}
          className="h-full max-h-20 w-full text-cyan-300"
        />
      ) : (
        <div className="flex items-center gap-3 text-sm font-bold uppercase text-neutral-500">
          <span className="h-3 w-3 rounded-full bg-neutral-600" />
          Waiting for assistant
        </div>
      )}
    </div>
  );
}
