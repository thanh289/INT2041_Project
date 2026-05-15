import os
import socket
import sys

from livekit import agents
from agent import entrypoint


def _acquire_single_instance_lock() -> socket.socket:
    """Prevent running multiple local worker instances that can duplicate audio replies."""
    lock_port = int(os.environ.get("AGENT_SINGLETON_PORT", "49591"))
    lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        lock_socket.bind(("127.0.0.1", lock_port))
    except OSError:
        print(
            f"Another ai-agent worker is already running (lock port {lock_port}). "
            "Stop the existing worker before starting a new one.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Keep the socket open for the process lifetime.
    lock_socket.listen(1)
    return lock_socket

if __name__ == "__main__":
    _singleton_lock = _acquire_single_instance_lock()
    agent_name = os.environ.get("LIVEKIT_AGENT_NAME", "blind_assistant")
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=agent_name,
        )
    )