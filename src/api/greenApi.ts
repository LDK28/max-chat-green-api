export type Credentials = { apiUrl: string; idInstance: string; apiTokenInstance: string };
export type InstanceState = 'authorized' | 'notAuthorized' | 'blocked' | 'starting' | 'suspended' | 'pendingPassword';
export type Notification = {
  receiptId: number;
  body: {
    typeWebhook: string;
    timestamp?: number;
    idMessage?: string;
    senderData?: { chatId?: string; senderPhoneNumber?: string | number; senderName?: string };
    messageData?: { typeMessage?: string; textMessageData?: { textMessage?: string } };
  };
};
export function validateCredentials(value: Credentials): Credentials {
  const apiUrl = value.apiUrl.trim().replace(/\/+$/, '');
  let url: URL;
  try { url = new URL(apiUrl); } catch { throw new Error('Укажите корректный HTTPS API URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('API URL должен быть HTTPS-адресом сервера без пути и параметров.');
  }
  const idInstance = value.idInstance.trim();
  const apiTokenInstance = value.apiTokenInstance.trim();
  if (!/^\d+$/.test(idInstance) || !apiTokenInstance || apiTokenInstance.includes('/')) throw new Error('Проверьте ID инстанса и API токен.');
  return { apiUrl, idInstance, apiTokenInstance };
}
export class GreenApi {
  private credentials: Credentials;
  constructor(credentials: Credentials) { this.credentials = validateCredentials(credentials); }
  private endpoint(method: string, suffix = ''): string {
    const { apiUrl, idInstance, apiTokenInstance } = this.credentials;
    return `${apiUrl}/waInstance${idInstance}/${method}/${encodeURIComponent(apiTokenInstance)}${suffix}`;
  }
  private async request<T>(method: string, options: RequestInit = {}, signal?: AbortSignal, suffix = ''): Promise<T> {
    let response: Response;
    try { response = await fetch(this.endpoint(method, suffix), { ...options, signal, cache: 'no-store' }); }
    catch (error) { if (signal?.aborted) throw error; throw new Error('Не удалось связаться с GREEN-API. Проверьте сеть и доступность API (CORS).'); }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new Error('Не удалось подключиться. Проверьте параметры инстанса.');
      let detail = '';
      try { const body: unknown = await response.json(); if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') detail = body.message; } catch { /* API may return plain text */ }
      throw new Error(detail || `Ошибка GREEN-API: HTTP ${response.status}`);
    }
    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
  }
  getState(signal?: AbortSignal) { return this.request<{ stateInstance: InstanceState }>('getStateInstance', {}, signal); }
  sendMessage(chatId: string, message: string, signal?: AbortSignal) {
    return this.request<{ idMessage: string }>('sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message }) }, signal);
  }
  checkAccount(phoneNumber: string, signal?: AbortSignal) {
    return this.request<{ exist: boolean; chatId: string; status?: boolean; reason?: string }>('checkAccount', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: Number(phoneNumber) }) }, signal);
  }
  receiveNotification(signal?: AbortSignal) { return this.request<Notification | null>('receiveNotification', {}, signal, '?receiveTimeout=5'); }
  deleteNotification(receiptId: number, signal?: AbortSignal) { return this.request<{ result: boolean }>('deleteNotification', { method: 'DELETE' }, signal, `/${receiptId}`); }
}
