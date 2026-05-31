import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

function hasEnded(state: { endedAt?: bigint | number | string } | undefined): boolean {
  const endedAt = state?.endedAt;
  if (typeof endedAt === 'bigint') {
    return endedAt > BigInt(0);
  }
  if (typeof endedAt === 'number') {
    return endedAt > 0;
  }
  if (typeof endedAt === 'string') {
    return endedAt !== '' && endedAt !== '0';
  }
  return false;
}

function isFinishedDispatch(dispatch: {
  state?: { jobs?: Array<{ state?: { endedAt?: bigint | number | string } }> };
}): boolean {
  const jobs = dispatch.state?.jobs;
  if (!jobs || jobs.length === 0) {
    return true;
  }
  return jobs.every((job) => hasEnded(job.state));
}

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get('room');
  const username = request.nextUrl.searchParams.get('username') || `User_${Math.floor(Math.random() * 1000)}`;
  const agentName = process.env.LIVEKIT_AGENT_NAME || 'blind_assistant';

  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    // Ensure room and dispatch exist (idempotent flow).
    const host = wsUrl.replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'https://' : 'http://'));
    const roomClient = new RoomServiceClient(host, apiKey, apiSecret);
    const dispatchClient = new AgentDispatchClient(host, apiKey, apiSecret);
    let forceRecreateAgentDispatch = false;

    try {
      await roomClient.createRoom({
        name: room,
        emptyTimeout: 10 * 60,
        departureTimeout: 60,
      });
    } catch (err: unknown) {
      const maybeCode = getErrorCode(err);
      if (maybeCode !== 'already_exists') {
        throw err;
      }
    }

    // Self-heal: if more than one agent participant is present, clear them to avoid duplicate voices.
    try {
      const participants = await roomClient.listParticipants(room);
      const connectedAgentParticipants = participants.filter(
        (participant) => participant.kind === 4 && participant.state === 2
      );

      if (connectedAgentParticipants.length > 1) {
        forceRecreateAgentDispatch = true;
        for (const participant of connectedAgentParticipants) {
          await roomClient.removeParticipant(room, participant.identity);
        }
      }
    } catch (err: unknown) {
      const maybeCode = getErrorCode(err);
      if (maybeCode !== 'not_found') {
        throw err;
      }
    }

    // Keep active dispatches to avoid client-side participant/track race conditions.
    // Only clear finished dispatches that can block new joins.
    let dispatches: any[] = [];
    try {
      dispatches = await dispatchClient.listDispatch(room);
    } catch (err: unknown) {
      const maybeCode = getErrorCode(err);
      if (maybeCode !== 'not_found') {
        throw err;
      }
    }

    let hasActiveAgentDispatch = false;
    for (const d of dispatches) {
      if (forceRecreateAgentDispatch && d.agentName === agentName) {
        if (d.id) {
          await dispatchClient.deleteDispatch(d.id, room);
        }
        continue;
      }

      if (isFinishedDispatch(d)) {
        if (d.id) {
          await dispatchClient.deleteDispatch(d.id, room);
        }
        continue;
      }

      if (d.agentName === agentName) {
        hasActiveAgentDispatch = true;
      }
    }

    if (!hasActiveAgentDispatch) {
      try {
        await dispatchClient.createDispatch(room, agentName);
      } catch (err: unknown) {
        const maybeCode = getErrorCode(err);
        if (maybeCode === 'not_found') {
          await roomClient.createRoom({
            name: room,
            emptyTimeout: 10 * 60,
            departureTimeout: 60,
          });
          await dispatchClient.createDispatch(room, agentName);
        } else if (maybeCode !== 'already_exists') {
          throw err;
        }
      }
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: username,
    });

    at.addGrant({ roomJoin: true, room: room });

    return NextResponse.json({ token: await at.toJwt() });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
