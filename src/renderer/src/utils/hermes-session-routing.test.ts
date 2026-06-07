import { describe, expect, it } from 'vitest';
import {
  buildHermesSessionMetadata,
  DEFAULT_HERMES_SESSION_ID,
  getHermesSessionId,
  routeVoiceTranscript,
} from './hermes-session-routing';

describe('hermes session routing', () => {
  it('falls back to chat-main when no active history exists', () => {
    expect(getHermesSessionId(null)).toBe(DEFAULT_HERMES_SESSION_ID);
    expect(getHermesSessionId('')).toBe(DEFAULT_HERMES_SESSION_ID);
  });

  it('uses current history uid as the explicit Hermes session id', () => {
    expect(getHermesSessionId('chat-other')).toBe('chat-other');
    expect(buildHermesSessionMetadata('chat-main', 'voice')).toEqual({
      session_id: 'chat-main',
      history_uid: 'chat-main',
      source: 'voice',
    });
  });

  it('routes normal voice transcript to the active session', () => {
    expect(routeVoiceTranscript('what did you find?', 'browser-search')).toEqual({
      kind: 'message',
      sessionId: 'browser-search',
      text: 'what did you find?',
    });
  });

  it('detects voice control commands', () => {
    expect(routeVoiceTranscript('where am I?', 'chat-main')).toEqual({
      kind: 'control',
      action: 'whereami',
    });
    expect(routeVoiceTranscript('list sessions', 'chat-main')).toEqual({
      kind: 'control',
      action: 'list-sessions',
    });
  });

  it('detects voice session switching and new-topic commands', () => {
    expect(routeVoiceTranscript('switch to browser search', 'chat-main')).toEqual({
      kind: 'switch',
      target: 'browser search',
    });
    expect(routeVoiceTranscript('start a new chat about Japan', 'chat-main')).toEqual({
      kind: 'new-session',
      title: 'Japan',
    });
  });
});
