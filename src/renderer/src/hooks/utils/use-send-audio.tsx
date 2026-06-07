import { useCallback } from "react";
import { useWebSocket } from "@/context/websocket-context";
import { useMediaCapture } from "@/hooks/utils/use-media-capture";
import { useChatHistory } from "@/context/chat-history-context";
import { buildHermesSessionMetadata } from "@/utils/hermes-session-routing";

export function useSendAudio() {
  const { sendMessage } = useWebSocket();
  const { captureAllMedia } = useMediaCapture();
  const { currentHistoryUid } = useChatHistory();

  const sendAudioPartition = useCallback(
    async (audio: Float32Array) => {
      const chunkSize = 4096;
      const sessionMetadata = buildHermesSessionMetadata(currentHistoryUid, 'voice');

      // Send the audio data in chunks
      for (let index = 0; index < audio.length; index += chunkSize) {
        const endIndex = Math.min(index + chunkSize, audio.length);
        const chunk = audio.slice(index, endIndex);
        sendMessage({
          type: "mic-audio-data",
          audio: Array.from(chunk),
          ...sessionMetadata,
          // Only send images with first chunk
        });
      }

      // Send end signal after all chunks
      const images = await captureAllMedia();
      sendMessage({ type: "mic-audio-end", images, ...sessionMetadata });
    },
    [sendMessage, captureAllMedia, currentHistoryUid],
  );

  return {
    sendAudioPartition,
  };
}
