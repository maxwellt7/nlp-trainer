export type HypnosisSessionType = 'daily_hypnosis' | 'general_chat';

export interface HypnosisConversationTarget {
  id: string;
  session_type: HypnosisSessionType;
}

export type InitialHypnosisTarget =
  | {
      action: 'load';
      sessionId: string;
    }
  | {
      action: 'start';
      sessionType: HypnosisSessionType;
    };

export function resolveInitialHypnosisTarget(
  search: string,
  conversations: HypnosisConversationTarget[],
  preferGeneralChat = false,
): InitialHypnosisTarget {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const requestedSessionId = params.get('sessionId');

  if (requestedSessionId) {
    return {
      action: 'load',
      sessionId: requestedSessionId,
    };
  }

  const mode = params.get('mode');
  if (mode === 'daily') {
    return { action: 'start', sessionType: 'daily_hypnosis' };
  }
  if (mode === 'general' || preferGeneralChat) {
    // The "General Chat" route/nav always opens a fresh open-ended chat.
    return { action: 'start', sessionType: 'general_chat' };
  }

  const [mostRecentConversation] = conversations;
  if (mostRecentConversation) {
    return {
      action: 'load',
      sessionId: mostRecentConversation.id,
    };
  }

  return {
    action: 'start',
    sessionType: 'general_chat',
  };
}
