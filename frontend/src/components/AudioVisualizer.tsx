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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: "0 1.5rem",
      }}
    >
      {agentTrackRef ? (
        <BarVisualizer
          state="listening"
          barCount={22}
          options={{ minHeight: 8 }}
          trackRef={agentTrackRef}
          style={{ width: "100%", maxHeight: "140px", color: "var(--color-primary)" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          {/* Idle waveform animation */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 20,
                  borderRadius: 3,
                  background: "rgba(14,165,233,0.25)",
                  animation: `idleBar 1.8s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            Waiting for assistant...
          </span>

          <style>{`
            @keyframes idleBar {
              0%,100% { height: 8px; opacity: 0.3; }
              50%      { height: 24px; opacity: 0.6; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}