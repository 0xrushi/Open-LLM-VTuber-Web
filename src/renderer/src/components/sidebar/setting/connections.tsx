/* eslint-disable import/no-extraneous-dependencies */
import {
  Badge,
  Box,
  Button,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '@/context/websocket-context';
import { settingStyles } from './setting-styles';

type ConnectionStatus = {
  ok: boolean;
  statusCode: number | null;
  error: string;
  checkedAt: number | null;
};

type ConnectionTarget = {
  key: string;
  name: string;
  url: string;
  method?: 'GET' | 'POST';
  probeType?: 'http' | 'ws';
};

const CHECK_TIMEOUT_MS = 5000;

function Connections(): JSX.Element {
  const { t } = useTranslation();
  const { baseUrl, wsUrl } = useWebSocket();
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [isChecking, setIsChecking] = useState(false);
  const daemonHost = useMemo(() => {
    let backendHost = '127.0.0.1';
    try {
      backendHost = new URL(baseUrl).hostname || backendHost;
    } catch {
      // keep default
    }
    return backendHost;
  }, [baseUrl]);

  const targets = useMemo<ConnectionTarget[]>(() => {
    const wsProbeUrl = wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')
      ? wsUrl
      : wsUrl.replace(/^http/, 'ws');
    return [
      { key: 'base', name: t('settings.connections.backendBase'), url: baseUrl },
      { key: 'ws', name: t('settings.connections.websocketEndpoint'), url: wsProbeUrl, probeType: 'ws' },
      { key: 'tts', name: t('settings.connections.tts'), url: `${baseUrl}/api/infra/tts-health` },
    ];
  }, [baseUrl, wsUrl, t, daemonHost]);

  const checkOne = async (target: ConnectionTarget): Promise<ConnectionStatus> => {
    if (target.probeType === 'ws') {
      return await new Promise((resolve) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve({
            ok: false,
            statusCode: null,
            error: 'WebSocket probe timed out',
            checkedAt: Date.now(),
          });
        }, CHECK_TIMEOUT_MS);

        try {
          const ws = new WebSocket(target.url);
          ws.onopen = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            ws.close();
            resolve({ ok: true, statusCode: null, error: '', checkedAt: Date.now() });
          };
          ws.onerror = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve({
              ok: false,
              statusCode: null,
              error: 'WebSocket connection failed',
              checkedAt: Date.now(),
            });
          };
        } catch (error) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          const message = error instanceof Error ? error.message : String(error);
          resolve({
            ok: false,
            statusCode: null,
            error: message,
            checkedAt: Date.now(),
          });
        }
      });
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const response = await fetch(target.url, {
        method: target.method || 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const backendDaemonUrl = payload && typeof payload.daemon_url === 'string'
        ? payload.daemon_url
        : `http://${daemonHost}:9377`;
      const payloadOk = typeof payload?.ok === 'boolean' ? payload.ok : undefined;
      const ok = payloadOk !== undefined ? payloadOk : response.ok;
      let error = '';
      if (!ok) {
        if (target.key === 'workers' && Array.isArray(payload?.missing_queues)) {
          error = `Missing worker queues: ${payload.missing_queues.join(', ') || 'unknown'}`;
        } else if (target.key === 'webbrowse') {
          error = payload?.error
            ? `${payload.error} (${backendDaemonUrl})`
            : `Daemon unreachable at ${backendDaemonUrl}`;
        } else if (typeof payload?.error === 'string') {
          error = payload.error;
        } else if (typeof payload?.message === 'string') {
          error = payload.message;
        } else {
          error = `HTTP ${response.status}`;
        }
      }
      return {
        ok,
        statusCode: response.status,
        error,
        checkedAt: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        statusCode: null,
        error: target.key === 'webbrowse'
          ? `Daemon unreachable at http://${daemonHost}:9377`
          : message,
        checkedAt: Date.now(),
      };
    } finally {
      window.clearTimeout(timer);
    }
  };

  const checkAll = async () => {
    setIsChecking(true);
    const nextEntries = await Promise.all(
      targets.map(async (target) => [target.key, await checkOne(target)] as const),
    );
    setStatuses(Object.fromEntries(nextEntries));
    setIsChecking(false);
  };

  useEffect(() => {
    checkAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.map((target) => target.url).join('|')]);

  return (
    <Stack {...settingStyles.common.container} maxW="full" gap={4}>
      <HStack justify="space-between" align="start">
        <Text fontSize="sm" color="var(--hermes-text-muted)" lineHeight="1.5">
          {t('settings.connections.description')}
        </Text>
        <Button
          size="sm"
          onClick={checkAll}
          loading={isChecking}
          bg="var(--hermes-surface-raised)"
          color="var(--hermes-text)"
          border="1px solid"
          borderColor="var(--hermes-border)"
          borderRadius="0"
          _hover={{ bg: 'var(--hermes-surface-muted)' }}
        >
          {t('settings.connections.refresh')}
        </Button>
      </HStack>

      <Stack gap={2}>
        {targets.map((target) => {
          const status = statuses[target.key];
          const isOk = status?.ok ?? false;
          const dotColor = isOk ? 'green.400' : 'red.400';
          return (
            <Box
              key={target.key}
              borderWidth="1px"
              borderColor="var(--hermes-border)"
              borderRadius="0"
              p={2}
              bg="var(--hermes-surface-raised)"
            >
              <HStack justify="space-between" align="start" gap={3}>
                <Stack gap={1} minW={0} flex="1">
                  <HStack>
                    <Box w="10px" h="10px" borderRadius="full" bg={dotColor} />
                    <Text color="var(--hermes-text)" fontSize="sm" fontWeight="semibold" lineHeight="1.25">
                      {target.name}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="var(--hermes-text-muted)" wordBreak="break-all" lineHeight="1.35">
                    {target.url}
                  </Text>
                  {!isOk && status?.error ? (
                    <Text fontSize="xs" color="var(--hermes-danger)" wordBreak="break-word">
                      {status.error}
                    </Text>
                  ) : null}
                </Stack>
                {status?.statusCode !== null && status?.statusCode !== undefined ? (
                  <Badge colorPalette={isOk ? 'green' : 'red'}>
                    HTTP {status.statusCode}
                  </Badge>
                ) : (
                  <Badge colorPalette={isOk ? 'green' : 'red'}>
                    {isOk ? 'OK' : 'ERROR'}
                  </Badge>
                )}
              </HStack>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

export default Connections;
