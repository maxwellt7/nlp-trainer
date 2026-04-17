interface ReadinessMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CreateHypnosisGuardInput {
  readyToGenerate: boolean;
  messages: ReadinessMessage[];
  initializing: boolean;
  loading: boolean;
  generating: boolean;
  isSelectedLocked: boolean;
  minimumUserMessages?: number;
}

function stripTrailingQuotesAndSpace(text: string) {
  return text.trimEnd().replace(/[\s"'”’`)}\]]+$/u, '');
}

export function endsWithQuestion(text?: string | null) {
  if (!text) return false;
  const normalized = stripTrailingQuotesAndSpace(text);
  return normalized.endsWith('?') || normalized.endsWith('？');
}

export function countUserMessages(messages: ReadinessMessage[] = []) {
  return messages.filter((message) => message.role === 'user' && message.content.trim()).length;
}

export function getLastSubstantiveMessage(messages: ReadinessMessage[] = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.content?.trim()) return message;
  }
  return null;
}

export function isSessionMarkedReady(sessionStatus?: string | null) {
  return sessionStatus === 'ready_for_hypnosis';
}

export function canShowCreateHypnosisCTA({
  readyToGenerate,
  messages,
  initializing,
  loading,
  generating,
  isSelectedLocked,
  minimumUserMessages = 3,
}: CreateHypnosisGuardInput) {
  if (!readyToGenerate || initializing || loading || generating || isSelectedLocked) {
    return false;
  }

  if (countUserMessages(messages) < minimumUserMessages) {
    return false;
  }

  const lastMessage = getLastSubstantiveMessage(messages);
  if (!lastMessage || lastMessage.role !== 'assistant') {
    return false;
  }

  if (endsWithQuestion(lastMessage.content)) {
    return false;
  }

  return true;
}
