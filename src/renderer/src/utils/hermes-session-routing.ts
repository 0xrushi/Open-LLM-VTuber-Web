export const DEFAULT_HERMES_SESSION_ID = 'chat-main';

export type HermesInputSource = 'text' | 'voice';

export interface HermesSessionMetadata {
  session_id: string;
  history_uid?: string;
  source: HermesInputSource;
}

export type VoiceRouteCommand =
  | { kind: 'message'; sessionId: string; text: string }
  | { kind: 'control'; action: 'whereami' | 'list-sessions' }
  | { kind: 'switch'; target: string }
  | { kind: 'new-session'; title?: string };

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

export const getHermesSessionId = (currentHistoryUid?: string | null): string => {
  const normalized = normalizeWhitespace(currentHistoryUid || '');
  return normalized || DEFAULT_HERMES_SESSION_ID;
};

export const buildHermesSessionMetadata = (
  currentHistoryUid: string | null | undefined,
  source: HermesInputSource,
): HermesSessionMetadata => {
  const sessionId = getHermesSessionId(currentHistoryUid);
  return {
    session_id: sessionId,
    ...(currentHistoryUid ? { history_uid: currentHistoryUid } : {}),
    source,
  };
};

const stripCommandPrefix = (text: string, prefixes: string[]): string | null => {
  const normalized = normalizeWhitespace(text.toLowerCase());
  const prefix = prefixes.find((candidate) => normalized.startsWith(candidate));
  if (!prefix) return null;
  return normalizeWhitespace(text.slice(prefix.length));
};

const inferNewSessionTitle = (text: string): string | undefined => {
  const normalized = normalizeWhitespace(text);
  const aboutMatch = normalized.match(/(?:new topic|start a new chat)(?: about| for)?\s+(.+)$/i);
  return aboutMatch?.[1]?.trim() || undefined;
};

export const routeVoiceTranscript = (
  transcript: string,
  activeSessionId: string = DEFAULT_HERMES_SESSION_ID,
): VoiceRouteCommand => {
  const text = normalizeWhitespace(transcript);
  const normalized = text.toLowerCase();

  if (!text) {
    return { kind: 'message', sessionId: activeSessionId, text };
  }

  if (normalized === 'where am i' || normalized === 'where am i?' || normalized.includes('what chat am i in')) {
    return { kind: 'control', action: 'whereami' };
  }

  if (
    normalized.includes('list my chats') ||
    normalized.includes('list chats') ||
    normalized.includes('list sessions') ||
    normalized.includes('show sessions')
  ) {
    return { kind: 'control', action: 'list-sessions' };
  }

  const switchTarget = stripCommandPrefix(text, [
    'continue the ',
    'switch to ',
    'go to ',
    'open ',
    'back to ',
    'continue ',
  ]);
  if (switchTarget) {
    return { kind: 'switch', target: switchTarget };
  }

  if (
    normalized === 'new topic' ||
    normalized.startsWith('new topic ') ||
    normalized.startsWith('start a new chat') ||
    normalized.startsWith('create a new chat')
  ) {
    return { kind: 'new-session', title: inferNewSessionTitle(text) };
  }

  return { kind: 'message', sessionId: activeSessionId, text };
};
