import type { Notification } from '../api/greenApi';

export type ChatMessage = {
  id: string;
  chatId: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status?: 'sending' | 'sent' | 'failed';
};

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

export function messageFromNotification(notification: Notification): ChatMessage | null {
  const { body } = notification;
  if (body.typeWebhook !== 'incomingMessageReceived' || body.messageData?.typeMessage !== 'textMessage') return null;

  const text = body.messageData.textMessageData?.textMessage;
  const chatId = body.senderData?.chatId;
  if (typeof text !== 'string' || !chatId) return null;

  return {
    id: body.idMessage || `receipt-${notification.receiptId}`,
    chatId,
    text,
    timestamp: (body.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
    direction: 'incoming',
  };
}

export function upsertMessage(messages: ChatMessage[], next: ChatMessage): ChatMessage[] {
  if (messages.some(item => item.id === next.id)) return messages;
  return [...messages, next].sort((a, b) => a.timestamp - b.timestamp);
}
