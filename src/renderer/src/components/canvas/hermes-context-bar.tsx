import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';

const formatCompactNumber = (value?: number | null): string => {
  if (!value || value <= 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(value);
};

const formatElapsed = (milliseconds?: number | null): string => {
  const totalSeconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const statusColor = (percent: number): string => {
  if (percent >= 85) return '#ff6b7a';
  if (percent >= 65) return '#ffd166';
  return '#5ff3b5';
};

const HermesContextBar = memo((): JSX.Element => {
  const { runtimeStatus, wsState } = useWebSocket();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (runtimeStatus?.state !== 'running') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runtimeStatus?.state, runtimeStatus?.prompt_started_at]);

  const view = useMemo(() => {
    const contextTokens = runtimeStatus?.context_tokens || 0;
    const contextLength = runtimeStatus?.context_length || 0;
    const percent = runtimeStatus?.context_percent ?? (contextLength ? Math.round((contextTokens / contextLength) * 100) : 0);
    const startedAt = runtimeStatus?.prompt_started_at || null;
    const liveElapsed = runtimeStatus?.state === 'running' && startedAt
      ? now - startedAt
      : runtimeStatus?.prompt_elapsed_ms || 0;

    return {
      model: runtimeStatus?.model_short || 'Hermes',
      provider: runtimeStatus?.provider || 'gateway',
      percent: Math.max(0, Math.min(100, percent || 0)),
      contextLabel: `${formatCompactNumber(contextTokens)}/${formatCompactNumber(contextLength)}`,
      compressions: runtimeStatus?.compressions || 0,
      backgroundCount: (runtimeStatus?.active_background_tasks || 0) + (runtimeStatus?.active_background_processes || 0),
      elapsed: formatElapsed(liveElapsed),
      isRunning: runtimeStatus?.state === 'running',
    };
  }, [runtimeStatus, now]);

  const accent = statusColor(view.percent);
  const connected = wsState === 'OPEN';
  const connectionLabel = connected ? 'LINK' : 'OFFLINE';
  const stateLabel = view.isRunning ? 'RUN' : 'IDLE';

  return (
    <Box
      minW={{ base: 'min(94vw, 560px)', md: '560px' }}
      maxW="94vw"
      px="12px"
      py="9px"
      color="#d8ffe9"
      bg="linear-gradient(180deg, rgba(5, 14, 18, 0.92), rgba(9, 22, 27, 0.86))"
      border="1px solid rgba(95, 243, 181, 0.46)"
      borderRadius="6px"
      boxShadow="0 0 0 1px rgba(0,0,0,0.65), 0 18px 52px rgba(0,0,0,0.42), 0 0 34px rgba(95,243,181,0.12), inset 0 1px 0 rgba(255,255,255,0.08)"
      backdropFilter="blur(12px) saturate(130%)"
      pointerEvents="none"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '3px',
        border: '1px solid rgba(117, 255, 201, 0.12)',
        borderRadius: '3px',
        pointerEvents: 'none',
      }}
      _after={{
        content: '""',
        position: 'absolute',
        left: '10px',
        right: '10px',
        top: '50%',
        height: '1px',
        bg: 'linear-gradient(90deg, transparent, rgba(117,255,201,0.09), transparent)',
        pointerEvents: 'none',
      }}
    >
      <VStack align="stretch" gap="7px" position="relative" zIndex={1}>
        <HStack justify="space-between" align="center" gap="12px">
          <HStack gap="8px" minW={0}>
            <Text fontSize="11px" color="#75ffc9" letterSpacing="0.12em" opacity={0.72}>
              ┌─ HERMES.RUNTIME
            </Text>
            <Box
              width="7px"
              height="13px"
              bg={connected ? accent : '#77848c'}
              boxShadow={connected ? `0 0 16px ${accent}` : 'none'}
              opacity={connected ? 0.95 : 0.45}
            />
            <Text fontSize="12px" fontWeight="800" letterSpacing="0.08em" color="#f4fff9" textTransform="uppercase" truncate>
              {view.model}
            </Text>
            <Text fontSize="11px" color="#8fbdae" opacity={0.8} truncate>
              ::{view.provider}
            </Text>
          </HStack>
          <HStack gap="0" flexShrink={0} color="#c8f7e1" fontSize="11px" letterSpacing="0.04em">
            <Box px="7px" py="2px" border="1px solid rgba(117,255,201,0.22)" borderRight="0" bg="rgba(7, 31, 34, 0.74)">BG {view.backgroundCount}</Box>
            <Box px="7px" py="2px" border="1px solid rgba(117,255,201,0.22)" borderRight="0" bg="rgba(7, 31, 34, 0.54)">CMP {view.compressions}</Box>
            <Box px="7px" py="2px" border="1px solid rgba(117,255,201,0.22)" bg="rgba(7, 31, 34, 0.74)">T+ {view.elapsed}</Box>
          </HStack>
        </HStack>

        <HStack gap="10px" align="center">
          <Text fontSize="10px" color="#75ffc9" opacity={0.78} minW="42px">CTX</Text>
          <Box flex="1" h="14px" bg="rgba(3, 10, 14, 0.9)" border="1px solid rgba(117,255,201,0.28)" overflow="hidden">
            <Box
              h="100%"
              width={`${view.percent}%`}
              bg={`repeating-linear-gradient(90deg, ${accent} 0 8px, rgba(255,255,255,0.18) 8px 9px, ${accent} 9px 17px)`}
              boxShadow={`0 0 20px ${accent}`}
              transition="width 400ms ease"
            />
          </Box>
          <Text minW="122px" textAlign="right" fontSize="11px" fontWeight="800" color="#f4fff9" letterSpacing="0.03em">
            {view.contextLabel} [{view.percent}%]
          </Text>
        </HStack>

        <HStack justify="space-between" fontSize="10px" color="#8fbdae" letterSpacing="0.10em" textTransform="uppercase">
          <Text>└─ NET:{connectionLabel}</Text>
          <Text color={view.isRunning ? '#ffd166' : '#75ffc9'}>STATE:{stateLabel}</Text>
        </HStack>
      </VStack>
    </Box>
  );
});

HermesContextBar.displayName = 'HermesContextBar';

export default HermesContextBar;
