/* eslint-disable func-names */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useChatHistory } from '@/context/chat-history-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { audioManager } from '@/utils/audio-manager';
import { toaster } from '@/components/ui/toaster';
import { useWebSocket } from '@/context/websocket-context';
import { DisplayText } from '@/services/websocket-service';
import { useLive2DExpression } from '@/hooks/canvas/use-live2d-expression';
import * as LAppDefine from '../../../WebSDK/src/lappdefine';

// Simple type alias for Live2D model
type Live2DModel = any;

const synthesizeFishSpeech = async (text: string, baseUrl?: string): Promise<string> => {
  if (!baseUrl) {
    throw new Error('Hermes UI adapter base URL is not configured; cannot synthesize Fish Audio TTS.');
  }

  const proxyUrl = `${baseUrl}/api/infra/tts-speech`;

  // Fish Audio is intentionally adapter-proxied only. Do not fall back to
  // browser speechSynthesis or browser-direct API keys; failures should be
  // visible so bad Fish configuration is fixed instead of silently masked.
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (response.ok) {
    return URL.createObjectURL(await response.blob());
  }

  const errorText = await response.text().catch(() => '');
  throw new Error(`Hermes UI Fish Audio proxy failed (${response.status}): ${errorText || response.statusText}`);
};

interface AudioTaskOptions {
  audioBase64: string
  audioMime?: string
  volumes: number[]
  sliceLength: number
  displayText?: DisplayText | null
  expressions?: string[] | number[] | null
  speaker_uid?: string
  forwarded?: boolean
  synthesizeInBrowser?: boolean
}

/**
 * Custom hook for handling audio playback tasks with Live2D lip sync
 */
export const useAudioTask = () => {
  const { t } = useTranslation();
  const { aiState, backendSynthComplete, setBackendSynthComplete } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { appendResponse, appendAIMessage } = useChatHistory();
  const { sendMessage, baseUrl } = useWebSocket();
  const { setExpression } = useLive2DExpression();

  // State refs to avoid stale closures
  const stateRef = useRef({
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  });

  // Note: currentAudioRef and currentModelRef are now managed by the global audioManager

  stateRef.current = {
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  };

  /**
   * Stop current audio playback and lip sync (delegates to global audioManager)
   */
  const stopCurrentAudioAndLipSync = useCallback(() => {
    audioManager.stopCurrentAudioAndLipSync();
  }, []);

  /**
   * Handle audio playback with Live2D lip sync
   */
  const handleAudioPlayback = (options: AudioTaskOptions): Promise<void> => new Promise((resolve, reject) => {
    const {
      aiState: currentAiState,
      setSubtitleText: updateSubtitle,
      appendResponse: appendText,
      appendAIMessage: appendAI,
    } = stateRef.current;

    // Skip if already interrupted
    if (currentAiState === 'interrupted') {
      console.warn('Audio playback blocked by interruption state.');
      resolve();
      return;
    }

    const {
      audioBase64, audioMime, displayText, expressions, forwarded, synthesizeInBrowser,
    } = options;

    // Update display text
    if (displayText) {
      appendText(displayText.text);
      appendAI(displayText.text, displayText.name, displayText.avatar);
      if (audioBase64) {
        updateSubtitle(displayText.text);
      }
      if (!forwarded) {
        sendMessage({
          type: "audio-play-start",
          display_text: displayText,
          forwarded: true,
        });
      }
    }

    // Use frontend-owned Fish Audio for plain Hermes text responses. The browser
    // speechSynthesis fallback is deliberately disabled so Fish/proxy failures
    // surface as real errors instead of being silently masked.
    if (synthesizeInBrowser && displayText?.text && !audioBase64) {
      synthesizeFishSpeech(displayText.text, baseUrl)
        .then((audioUrl) => {
          const audio = new Audio(audioUrl);
          audioManager.setCurrentAudio(audio, null);
          let isFinished = false;
          let didStartVrmAudio = false;

          const cleanup = () => {
            if (didStartVrmAudio) {
              didStartVrmAudio = false;
              window.dispatchEvent(new CustomEvent('vrm-audio-stop'));
            }
            audioManager.clearCurrentAudio(audio);
            URL.revokeObjectURL(audioUrl);
            if (!isFinished) {
              isFinished = true;
              resolve();
            }
          };

          audio.addEventListener('canplaythrough', () => {
            if (stateRef.current.aiState === 'interrupted' || !audioManager.hasCurrentAudio()) {
              console.warn('Fish Audio playback cancelled due to interruption or audio was stopped');
              cleanup();
              return;
            }
            updateSubtitle(displayText.text);
            didStartVrmAudio = true;
            window.dispatchEvent(new CustomEvent('vrm-audio-start'));
            audio.play().catch((error) => {
              console.error('Fish Audio audio play error:', error);
              cleanup();
            });
          });

          audio.addEventListener('ended', cleanup);
          audio.addEventListener('error', (error) => {
            console.error('Fish Audio audio playback error:', error);
            cleanup();
          });
          audio.load();
        })
        .catch((error) => {
          const message = `Fish Audio speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error(message, error);
          toaster.create({
            title: message,
            type: 'error',
            duration: 6000,
          });
          window.dispatchEvent(new CustomEvent('vrm-audio-stop'));
          reject(new Error(message));
        });
      return;
    }

    try {
      // Process audio if available
      if (audioBase64) {
        const audioDataUrl = `data:${audioMime || 'audio/wav'};base64,${audioBase64}`;

        // Try to get Live2D manager and model (optional for VRM models)
        const live2dManager = (window as any).getLive2DManager?.();
        let model: Live2DModel | null = null;
        let hasLive2D = false;

        if (live2dManager) {
          model = live2dManager.getModel(0);
          if (model) {
            hasLive2D = true;
            console.log('Found Live2D model for audio playback with lip sync');

            if (!model._wavFileHandler) {
              console.warn('Model does not have _wavFileHandler for lip sync');
            } else {
              console.log('Model has _wavFileHandler available');
            }

            // Set expression if available
            const lappAdapter = (window as any).getLAppAdapter?.();
            if (lappAdapter && expressions?.[0] !== undefined) {
              setExpression(
                expressions[0],
                lappAdapter,
                `Set expression to: ${expressions[0]}`,
              );
            }

            // Start talk motion
            if (LAppDefine && LAppDefine.PriorityNormal) {
              console.log("Starting random 'Talk' motion");
              model.startRandomMotion(
                "Talk",
                LAppDefine.PriorityNormal,
              );
            }
          }
        } else {
          console.log('Live2D manager not found - using VRM mode (audio only, no lip sync)');
        }

        // Setup audio element (works for both Live2D and VRM models)
        const audio = new Audio(audioDataUrl);

        // Register with global audio manager
        audioManager.setCurrentAudio(audio, model);
        let isFinished = false;
        let didStartVrmAudio = false;

        const stopVrmAudio = () => {
          if (!didStartVrmAudio) return;
          didStartVrmAudio = false;
          window.dispatchEvent(new CustomEvent('vrm-audio-stop'));
        };

        const cleanup = () => {
          stopVrmAudio();
          audioManager.clearCurrentAudio(audio);
          if (!isFinished) {
            isFinished = true;
            resolve();
          }
        };

        // Enhance lip sync sensitivity (only for Live2D)
        const lipSyncScale = 2.0;

        audio.addEventListener('canplaythrough', () => {
          // Check for interruption before playback
          if (stateRef.current.aiState === 'interrupted' || !audioManager.hasCurrentAudio()) {
            console.warn('Audio playback cancelled due to interruption or audio was stopped');
            cleanup();
            return;
          }

          console.log('Starting audio playback' + (hasLive2D ? ' with lip sync' : ' (VRM mode)'));
          didStartVrmAudio = true;
          window.dispatchEvent(new CustomEvent('vrm-audio-start'));
          audio.play().catch((err) => {
            console.error("Audio play error:", err);
            cleanup();
          });

          // Setup lip sync only if Live2D model is available
          if (hasLive2D && model && model._wavFileHandler) {
            if (!model._wavFileHandler._initialized) {
              console.log('Applying enhanced lip sync');
              model._wavFileHandler._initialized = true;

              const originalUpdate = model._wavFileHandler.update.bind(model._wavFileHandler);
              model._wavFileHandler.update = function (deltaTimeSeconds: number) {
                const result = originalUpdate(deltaTimeSeconds);
                // @ts-ignore
                this._lastRms = Math.min(2.0, this._lastRms * lipSyncScale);
                return result;
              };
            }

            if (audioManager.hasCurrentAudio()) {
              model._wavFileHandler.start(audioDataUrl);
            } else {
              console.warn('WavFileHandler start skipped - audio was stopped');
            }
          }
        });

        audio.addEventListener('ended', () => {
          console.log("Audio playback completed");
          cleanup();
        });

        audio.addEventListener('error', (error) => {
          console.error("Audio playback error:", error);
          cleanup();
        });

        audio.load();
      } else {
        resolve();
      }
    } catch (error) {
      console.error('Audio playback setup error:', error);
      toaster.create({
        title: `${t('error.audioPlayback')}: ${error}`,
        type: "error",
        duration: 2000,
      });
      resolve();
    }
  });

  // Handle backend synthesis completion
  useEffect(() => {
    let isMounted = true;

    const handleComplete = async () => {
      await audioTaskQueue.waitForCompletion();
      if (isMounted && backendSynthComplete) {
        stopCurrentAudioAndLipSync();
        sendMessage({ type: "frontend-playback-complete" });
        setBackendSynthComplete(false);
      }
    };

    handleComplete();

    return () => {
      isMounted = false;
    };
  }, [backendSynthComplete, sendMessage, setBackendSynthComplete, stopCurrentAudioAndLipSync]);

  /**
   * Add a new audio task to the queue
   */
  const addAudioTask = async (options: AudioTaskOptions) => {
    const { aiState: currentState } = stateRef.current;

    if (currentState === 'interrupted') {
      console.log('Skipping audio task due to interrupted state');
      return;
    }

    console.log(`Adding audio task ${options.displayText?.text} to queue`);
    audioTaskQueue.addTask(() => handleAudioPlayback(options));
  };

  return {
    addAudioTask,
    appendResponse,
    stopCurrentAudioAndLipSync,
  };
};
