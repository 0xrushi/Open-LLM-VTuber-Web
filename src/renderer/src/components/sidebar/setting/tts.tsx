/* eslint-disable import/no-extraneous-dependencies */
import {
  Badge,
  Box,
  Button,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { settingStyles } from './setting-styles';

type TtsHealth = {
  ok?: boolean;
  provider?: string;
  voice_id?: string;
  model_id?: string;
  tier?: string;
  character_count?: number;
  character_limit?: number;
  message?: string;
  error?: unknown;
};

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
const ELEVENLABS_VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) || '21m00Tcm4TlvDq8ikWAM';
const ELEVENLABS_MODEL_ID = (import.meta.env.VITE_ELEVENLABS_MODEL_ID as string | undefined) || 'eleven_multilingual_v2';
const ELEVENLABS_OUTPUT_FORMAT = (import.meta.env.VITE_ELEVENLABS_OUTPUT_FORMAT as string | undefined) || 'mp3_44100_128';

function formatError(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function TTS(): JSX.Element {
  const { baseUrl } = useWebSocket();
  const [health, setHealth] = useState<TtsHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const checkTts = useCallback(async () => {
    setIsChecking(true);
    setError('');
    try {
      const response = await fetch(`${baseUrl}/api/infra/tts-health`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      setHealth(payload);
      if (!response.ok || payload?.ok === false) {
        setError(formatError(payload?.error) || `HTTP ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setHealth(null);
    } finally {
      setIsChecking(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    checkTts();
  }, [checkTts]);

  const usesElevenLabs = Boolean(ELEVENLABS_API_KEY);
  const ok = health?.ok !== false && !error;

  return (
    <Stack {...settingStyles.common.container} maxW="full">
      <HStack justify="space-between" align="center">
        <Stack gap={1}>
          <Text color="var(--hermes-text)" fontSize="sm" fontWeight="semibold">
            Frontend TTS
          </Text>
          <Text color="var(--hermes-text-muted)" fontSize="xs" lineHeight="1.5">
            Hermes sends text; this UI speaks it locally with ElevenLabs when configured, otherwise browser speechSynthesis.
          </Text>
        </Stack>
        <Button
          size="sm"
          onClick={checkTts}
          loading={isChecking}
          bg="var(--hermes-surface-raised)"
          color="var(--hermes-text)"
          border="1px solid"
          borderColor="var(--hermes-border)"
          borderRadius="0"
          _hover={{ bg: 'var(--hermes-surface-muted)' }}
        >
          Check
        </Button>
      </HStack>

      <Box
        borderWidth="1px"
        borderColor="var(--hermes-border)"
        borderRadius="0"
        p={3}
        bg="var(--hermes-surface-raised)"
      >
        <HStack justify="space-between" align="start">
          <Stack gap={2}>
            <HStack>
              <Box w="10px" h="10px" borderRadius="full" bg={ok ? 'green.400' : 'red.400'} />
              <Text color="var(--hermes-text)" fontSize="sm" fontWeight="semibold">
                {usesElevenLabs ? 'ElevenLabs' : 'Browser speechSynthesis fallback'}
              </Text>
            </HStack>

            <Stack gap={1}>
              <Text color="var(--hermes-text-muted)" fontSize="xs">
                API key: {usesElevenLabs ? 'configured' : 'not configured'}
              </Text>
              {usesElevenLabs ? (
                <>
                  <Text color="var(--hermes-text-muted)" fontSize="xs">Voice ID: {ELEVENLABS_VOICE_ID}</Text>
                  <Text color="var(--hermes-text-muted)" fontSize="xs">Model: {ELEVENLABS_MODEL_ID}</Text>
                  <Text color="var(--hermes-text-muted)" fontSize="xs">Output: {ELEVENLABS_OUTPUT_FORMAT}</Text>
                </>
              ) : null}
              {health?.tier ? (
                <Text color="var(--hermes-text-muted)" fontSize="xs">
                  ElevenLabs tier: {health.tier}
                  {typeof health.character_count === 'number' && typeof health.character_limit === 'number'
                    ? ` (${health.character_count}/${health.character_limit} chars)`
                    : ''}
                </Text>
              ) : null}
              {health?.message ? (
                <Text color="var(--hermes-text-muted)" fontSize="xs">{health.message}</Text>
              ) : null}
              {error ? (
                <Text color="var(--hermes-danger)" fontSize="xs" wordBreak="break-word">{error}</Text>
              ) : null}
            </Stack>
          </Stack>
          <Badge colorPalette={ok ? 'green' : 'red'}>{ok ? 'OK' : 'ERROR'}</Badge>
        </HStack>
      </Box>
    </Stack>
  );
}

export default TTS;
