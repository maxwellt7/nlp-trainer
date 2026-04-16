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
): InitialHypnosisTarget {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if (params.get('mode') === 'daily') {
    return {
      action: 'start',
      sessionType: 'daily_hypnosis',
    };
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
