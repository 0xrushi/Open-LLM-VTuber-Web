import { useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState } from '@/context/ai-state-context';
import { useInterrupt } from '@/components/canvas/live2d';
import { useChatHistory } from '@/context/chat-history-context';
import { useVAD } from '@/context/vad-context';
import { useMediaCapture } from '@/hooks/utils/use-media-capture';
import { resolveSceneActionFromSkill } from '@/skills/scene-actions/scene-action-skill';

const dispatchSceneAction = (action: string, objectId: string, sourceText: string): boolean => {
  if (!objectId) return false;
  window.dispatchEvent(new CustomEvent('ai-scene-action', {
    detail: {
      action,
      objectId,
      sourceText,
    },
  }));
  return true;
};

export const dispatchSceneActionFromText = (text: string): boolean => {
  const resolution = resolveSceneActionFromSkill(text);
  if (!resolution) return false;

  if (resolution.type === 'stand') {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: {
        action: 'stand',
        sourceText: text,
      },
    }));
    return true;
  }

  if (resolution.target === 'none') {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: {
        action: resolution.action,
        sourceText: text,
      },
    }));
    return true;
  }

  return dispatchSceneAction(resolution.action, resolution.objectId ?? '', text);
};

export function useTextInput() {
  const [inputText, setInputText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const wsContext = useWebSocket();
  const { aiState } = useAiState();
  const { interrupt } = useInterrupt();
  const { appendHumanMessage } = useChatHistory();
  const { stopMic, autoStopMic } = useVAD();
  const { captureAllMedia } = useMediaCapture();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const trimmedText = inputText.trim();

    // Scene actions are purely frontend — dispatch them even without a backend connection.
    const handledSceneAction = dispatchSceneActionFromText(trimmedText);
    if (handledSceneAction) {
      appendHumanMessage(trimmedText);
      if (autoStopMic) stopMic();
      setInputText('');
      return;
    }

    if (!wsContext) return;
    if (aiState === 'thinking-speaking') {
      interrupt();
    }

    const images = await captureAllMedia();

    appendHumanMessage(trimmedText);
    wsContext.sendMessage({
      type: 'text-input',
      text: trimmedText,
      images,
    });

    if (autoStopMic) stopMic();
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  return {
    inputText,
    setInputText: handleInputChange,
    handleSend,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
  };
}
