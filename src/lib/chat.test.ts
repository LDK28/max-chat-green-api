import { describe, expect, it } from 'vitest';
import { messageFromNotification, normalizePhone, upsertMessage } from './chat';
describe('chat helpers', () => {
  it('accepts a phone with punctuation', () => expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567'));
  it('rejects malformed phone numbers', () => expect(normalizePhone('test 123')).toBeNull());
  it('parses an incoming MAX message', () => {
    expect(messageFromNotification({ receiptId: 1, body: { typeWebhook: 'incomingMessageReceived', idMessage: 'abc', timestamp: 100, senderData: { chatId: '123' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } } } })).toEqual({ id: 'abc', chatId: '123', text: 'Привет', timestamp: 100000, direction: 'incoming' });
  });
  it('ignores non-text events', () => expect(messageFromNotification({ receiptId: 1, body: { typeWebhook: 'outgoingMessageStatus' } })).toBeNull());
  it('does not add the same message twice', () => { const item = { id: '1', chatId: '2', text: 'Hi', timestamp: 1, direction: 'incoming' as const }; expect(upsertMessage([item], item)).toHaveLength(1); });
});
