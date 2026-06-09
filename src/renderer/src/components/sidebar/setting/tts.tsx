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
  reference_id?: string;
  model_id?: string;
  format?: string;
  sample_rate?: number;
  mp3_bitrate?: number;
  configured?: boolean;
  tier?: string;
  character_count?: number;
  character_limit?: number;
  message?: string;
  error?: unknown;
};

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

  const usesFishAudio = health?.provider === 'fish-audio';
  const ok = health?.ok !== false && !error;

  return (
    <Stack {...settingStyles.common.container} maxW="full">
      <HStack justify="space-between" align="center">
        <Stack gap={1}>
          <Text color="var(--hermes-text)" fontSize="sm" fontWeight="semibold">
            Frontend TTS
          </Text>
          <Text color="var(--hermes-text-muted)" fontSize="xs" lineHeight="1.5">
            Hermes sends text; this UI speaks it through the Fish Audio adapter proxy. Browser speechSynthesis fallback is disabled.
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
                {usesFishAudio ? 'Fish Audio' : 'Fish Audio not configured'}
              </Text>
            </HStack>

            <Stack gap={1}>
              <Text color="var(--hermes-text-muted)" fontSize="xs">
                API key: {usesFishAudio ? 'configured in adapter' : 'missing or invalid'}
              </Text>
              {usesFishAudio ? (
                <>
                  <Text color="var(--hermes-text-muted)" fontSize="xs">Reference ID: {health?.reference_id || health?.voice_id || 'default voice'}</Text>
                  <Text color="var(--hermes-text-muted)" fontSize="xs">Model: {health?.model_id ?? 'unknown'}</Text>
                  <Text color="var(--hermes-text-muted)" fontSize="xs">
                    Output: {health?.format ?? 'mp3'}
                    {typeof health?.sample_rate === 'number' ? ` @ ${health.sample_rate} Hz` : ''}
                    {typeof health?.mp3_bitrate === 'number' ? ` / ${health.mp3_bitrate} kbps` : ''}
                  </Text>
                </>
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
