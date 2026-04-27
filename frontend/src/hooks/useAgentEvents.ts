import { useEffect } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';

export function useAgentEvents() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const strData = new TextDecoder().decode(payload);
        const data = JSON.parse(strData);

        if (data.type?.startsWith('control_')) {
          const target = data.type.replace('control_', ''); // camera, microphone, chat
          const status = data.status; // on, off
          
          if (!localParticipant) return;

          console.log(`Nhận lệnh từ Agent: Bật/Tắt ${target} -> ${status}`);
          
          if (target === 'microphone') {
            localParticipant.setMicrophoneEnabled(status === 'on');
            announceToScreenReader(`Hệ thống đã tự động ${status === 'on' ? 'bật' : 'tắt'} microphone`);
          } else if (target === 'camera') {
            localParticipant.setCameraEnabled(status === 'on');
            announceToScreenReader(`Hệ thống đã tự động ${status === 'on' ? 'bật' : 'tắt'} camera`);
          }
        }
      } catch (err) {
        console.error("Lỗi parse data:", err);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, localParticipant]);
}

// Tiện ích để gửi thông báo cho trình đọc màn hình bằng Live Region
function announceToScreenReader(message: string) {
  const el = document.getElementById('a11y-announcer');
  if (el) {
    el.textContent = '';
    setTimeout(() => {
      el.textContent = message;
    }, 50); // delay nhỏ để trình duyệt nhận diện thay đổi nội dung text
  }
}
