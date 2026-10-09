import { describe, expect, it } from 'vitest';
import { messageFromNotification, normalizePhone, upsertMessage } from './chat';

describe('chat helpers', () => {
  it('accepts an international phone with punctuation', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
  });

  it('accepts international E.164-sized numbers', () => {
    expect(normalizePhone('+31 6 12345678')).toBe('31612345678');
  });

  it('rejects letters and malformed phone numbers', () => {
    expect(normalizePhone('test 1234567')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });

  it('parses an incoming MAX message', () => {
    expect(messageFromNotification({
      receiptId: 1,
      body: {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'abc',
        timestamp: 100,
        senderData: { chatId: '123' },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
      },
    })).toEqual({
      id: 'abc',
      chatId: '123',
      text: 'Привет',
      timestamp: 100000,
      direction: 'incoming',
    });
  });

  it('ignores non-text events', () => {
    expect(messageFromNotification({ receiptId: 1, body: { typeWebhook: 'outgoingMessageStatus' } })).toBeNull();
  });

  it('does not add the same message twice', () => {
    const item = { id: '1', chatId: '2', text: 'Hi', timestamp: 1, direction: 'incoming' as const };
    expect(upsertMessage([item], item)).toHaveLength(1);
  });
});
