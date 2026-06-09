import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { toaster } from '@/components/ui/toaster';
import { useAiState } from '@/context/ai-state-context';
import { useVAD } from '@/context/vad-context';
import { NanoWakeWordDetector } from '@/utils/nanowakeword-detector';

interface WakeWordState {
  wakeWordListening: boolean;
  wakeWordEnabled: boolean;
  setWakeWordEnabled: (enabled: boolean) => void;
  lastWakeWordScore: number;
}

const WAKEWORD_ENABLED_STORAGE_KEY = 'heyNamiWakeWordEnabled';

export const WakeWordContext = createContext<WakeWordState | null>(null);

function canListenForWakeWord(aiState: string, micOn: boolean): boolean {
  return !micOn && (aiState === 'idle' || aiState === 'waiting');
}

async function playBoop(): Promise<void> {
  const audio = new Audio('/audio/hey-nami-boop.mp3');
  audio.volume = 0.85;
  try {
    await audio.play();
  } catch (error) {
    console.warn('[WakeWord] Could not play boop sound:', error);
  }
}

export function WakeWordProvider({ children }: { children: React.ReactNode }) {
  const { aiState } = useAiState();
  const {
    micOn, startMic, setAutoStopMic,
  } = useVAD();
  const [wakeWordListening, setWakeWordListening] = useState(false);
  const [lastWakeWordScore, setLastWakeWordScore] = useState(0);
  const [wakeWordEnabled, setWakeWordEnabledState] = useState(() => {
    const persisted = localStorage.getItem(WAKEWORD_ENABLED_STORAGE_KEY);
    return persisted === null ? true : persisted === 'true';
  });
  const detectorRef = useRef<NanoWakeWordDetector | null>(null);
  const startMicRef = useRef(startMic);
  const setAutoStopMicRef = useRef(setAutoStopMic);
  const isStartingRef = useRef(false);
  const notifiedFailureRef = useRef(false);

  useEffect(() => {
    startMicRef.current = startMic;
  }, [startMic]);

  useEffect(() => {
    setAutoStopMicRef.current = setAutoStopMic;
  }, [setAutoStopMic]);

  const stopWakeWord = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setWakeWordListening(false);
    isStartingRef.current = false;
  }, []);

  const setWakeWordEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(WAKEWORD_ENABLED_STORAGE_KEY, String(enabled));
    setWakeWordEnabledState(enabled);
    if (!enabled) stopWakeWord();
  }, [stopWakeWord]);

  const startWakeWord = useCallback(async () => {
    if (detectorRef.current || isStartingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    isStartingRef.current = true;
    const detector = new NanoWakeWordDetector({
      threshold: 0.92,
      cooldownMs: 2500,
      consecutiveDetections: 1,
      onScore: setLastWakeWordScore,
      onDetected: async () => {
        stopWakeWord();
        await playBoop();
        setAutoStopMicRef.current(true);
        await startMicRef.current({ source: 'wakeword' });
      },
    });

    try {
      await detector.start();
      detectorRef.current = detector;
      setWakeWordListening(true);
      notifiedFailureRef.current = false;
    } catch (error: any) {
      detector.stop();
      console.error('[WakeWord] Failed to start wake word listener:', error);
      if (!notifiedFailureRef.current) {
        notifiedFailureRef.current = true;
        toaster.create({
          title: 'Wake word listener failed',
          description: error?.message ?? String(error),
          type: 'error',
          duration: 5000,
        });
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [stopWakeWord]);

  useEffect(() => {
    if (!wakeWordEnabled) {
      stopWakeWord();
      return;
    }

    if (canListenForWakeWord(aiState, micOn)) {
      void startWakeWord();
    } else {
      stopWakeWord();
    }
  }, [aiState, micOn, startWakeWord, stopWakeWord, wakeWordEnabled]);

  useEffect(() => () => {
    stopWakeWord();
  }, [stopWakeWord]);

  const value = useMemo(() => ({
    wakeWordListening,
    wakeWordEnabled,
    setWakeWordEnabled,
    lastWakeWordScore,
  }), [lastWakeWordScore, setWakeWordEnabled, wakeWordEnabled, wakeWordListening]);

  return (
    <WakeWordContext.Provider value={value}>
      {children}
    </WakeWordContext.Provider>
  );
}

export function useWakeWord() {
  const context = useContext(WakeWordContext);
  if (!context) {
    throw new Error('useWakeWord must be used within WakeWordProvider');
  }
  return context;
}
