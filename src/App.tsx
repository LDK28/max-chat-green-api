import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, CircleHelp, LogOut, MessageCircle, Plus, Search, Send, ShieldCheck, WifiOff, X } from 'lucide-react';
import { GreenApi, type Credentials } from './api/greenApi';
import { messageFromNotification, normalizePhone, upsertMessage, type ChatMessage } from './lib/chat';

const formatTime = (timestamp: number) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Неизвестная ошибка';

function Brand() {
  return <div className="brand"><span className="brand-icon"><MessageCircle size={23} fill="currentColor" /></span><strong>MAX<span>.</span></strong></div>;
}

function Login({ onConnect }: { onConnect: (credentials: Credentials) => Promise<void> }) {
  const [apiUrl, setApiUrl] = useState('');
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await onConnect({ apiUrl, idInstance, apiTokenInstance }); }
    catch (caught) { setError(errorText(caught)); }
    finally { setBusy(false); }
  }

  return <div className="login-page">
    <header className="site-header"><Brand /><span>Безопасное подключение</span></header>
    <div className="login-layout">
      <section className="intro">
        <p className="eyebrow"><span className="status-dot" /> МЕССЕНДЖЕР НОВОГО ПОКОЛЕНИЯ</p>
        <h1>Общение<br /><em>без границ.</em></h1>
        <p className="intro-copy">Лаконичный веб-клиент MAX для обмена сообщениями через GREEN-API. Всё необходимое, ничего лишнего.</p>
        <p className="security-note"><ShieldCheck size={19} /> Данные подключения не сохраняются на сервере</p>
        <div className="mock-chat">
          <div className="mock-header"><span className="mock-avatar">М</span><b>Ваш новый чат<small>В сети</small></b>•••</div>
          <div className="mock-bubble">Привет! 👋 Давай на связи.<small>12:41</small></div>
          <div className="mock-bubble mock-bubble--right">Конечно! Уже подключаюсь ✨<small>12:42 ✓✓</small></div>
        </div>
      </section>
      <section className="login-card">
        <span className="card-icon"><ArrowRight /></span>
        <h2>Подключить аккаунт</h2>
        <p>Введите данные инстанса GREEN-API, чтобы начать общение.</p>
        <form onSubmit={submit}>
          <label htmlFor="api-url">API URL</label>
          <input id="api-url" required type="url" autoComplete="off" placeholder="https://xxxx.api.green-api.com" value={apiUrl} onChange={event => setApiUrl(event.target.value)} />
          <label htmlFor="instance-id">ID инстанса</label>
          <input id="instance-id" required inputMode="numeric" autoComplete="off" placeholder="Например, 3100000000" value={idInstance} onChange={event => setIdInstance(event.target.value)} />
          <label htmlFor="api-token">API токен</label>
          <div className="password-row"><input id="api-token" required autoComplete="off" type={visible ? 'text' : 'password'} placeholder="Введите API токен" value={apiTokenInstance} onChange={event => setApiTokenInstance(event.target.value)} /><button type="button" onClick={() => setVisible(value => !value)}>{visible ? 'Скрыть' : 'Показать'}</button></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Подключаемся…' : 'Подключиться'} {!busy && <ArrowRight size={18} />}</button>
        </form>
        <div className="login-help"><CircleHelp size={16} /><span>Где взять данные? <a href="https://console.green-api.com/" rel="noreferrer" target="_blank">Личный кабинет <ArrowRight size={13}/></a></span></div>
      </section>
    </div>
    <footer className="site-footer"><span>© 2026 MAX Chat</span><span>Создано с помощью GREEN-API</span></footer>
  </div>;
}

type ChatInfo = { phone: string; chatId: string };

function Chat({ client, onLogout }: { client: GreenApi; onLogout: () => void }) {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [newChatError, setNewChatError] = useState('');
  const [creating, setCreating] = useState(false);
  const [pollError, setPollError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatsRef = useRef(chats);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  useEffect(() => {
    const controller = new AbortController();
    let running = true;
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    async function poll() {
      while (running) {
        try {
          const notification = await client.receiveNotification(controller.signal);
          if (!running) return;
          if (notification) {
            const message = messageFromNotification(notification);
            if (message) {
              const senderPhone = notification.body.senderData?.senderPhoneNumber;
              const normalized = senderPhone == null ? null : normalizePhone(String(senderPhone));
              const match = chatsRef.current.find(item => item.chatId === message.chatId || item.phone === normalized);
              const displayPhone = match?.phone ?? normalized ?? message.chatId;
              const canonicalChatId = message.chatId;
              setChats(old => old.some(item => item.phone === displayPhone) ? old : [{ phone: displayPhone, chatId: canonicalChatId }, ...old]);
              setMessages(old => upsertMessage(old, { ...message, chatId: displayPhone }));
            }
            const result = await client.deleteNotification(notification.receiptId, controller.signal);
            if (!result.result) throw new Error('Не удалось подтвердить получение уведомления');
          }
          setPollError('');
        } catch (caught) {
          if (!running || controller.signal.aborted) return;
          setPollError(errorText(caught));
          await wait(3500);
        }
      }
    }
    void poll();
    return () => { running = false; controller.abort(); };
  }, [client]);

  const currentMessages = useMemo(() => messages.filter(item => item.chatId === active), [messages, active]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active, currentMessages.length]);

  async function createChat(event: FormEvent) {
    event.preventDefault();
    const digits = normalizePhone(phone);
    if (!digits) { setNewChatError('Введите номер РФ (+7) или Беларуси (+375) с кодом страны.'); return; }
    setCreating(true);
    setNewChatError('');
    try {
      const result = await client.checkAccount(digits);
      if (!result.exist || !result.chatId) { setNewChatError(result.reason || 'Получатель не найден в MAX.'); return; }
      setChats(old => old.some(item => item.phone === digits) ? old : [{ phone: digits, chatId: result.chatId }, ...old]);
      setActive(digits);
      setDraft('');
      setSidebarOpen(false);
      setDialogOpen(false);
      setPhone('');
    } catch (caught) { setNewChatError(errorText(caught)); }
    finally { setCreating(false); }
  }

  async function transmit(message: ChatMessage) {
    const chatId = chatsRef.current.find(item => item.phone === message.chatId)?.chatId;
    if (!chatId) {
      setMessages(old => old.map(item => item.id === message.id ? { ...item, status: 'failed' } : item));
      return;
    }
    try {
      const sent = await client.sendMessage(chatId, message.text);
      setMessages(old => old.map(item => item.id === message.id ? { ...item, id: sent.idMessage || item.id, status: 'sent' } : item));
    } catch {
      setMessages(old => old.map(item => item.id === message.id ? { ...item, status: 'failed' } : item));
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim()) return;
    const next: ChatMessage = { id: `local-${crypto.randomUUID()}`, chatId: active, text: draft.trim(), direction: 'outgoing', timestamp: Date.now(), status: 'sending' };
    setDraft('');
    setMessages(old => upsertMessage(old, next));
    void transmit(next);
  }

  const filtered = chats.filter(chat => chat.phone.includes(search.replace(/\D/g, '')));
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar-header"><Brand /><button className="icon-button" onClick={onLogout} title="Отключиться" aria-label="Отключиться"><LogOut size={18}/></button></div>
      <div className="sidebar-controls"><div className="section-heading"><h3>Сообщения</h3><span>{chats.length}</span></div><button className="new-chat" onClick={() => setDialogOpen(true)}><Plus size={18}/> Новый чат</button><div className="search-field"><Search size={18}/><input aria-label="Поиск по номеру" placeholder="Поиск по номеру" value={search} onChange={event => setSearch(event.target.value)}/></div></div>
      <div className="chat-list">{filtered.length ? filtered.map(chat => {
        const latest = messages.filter(message => message.chatId === chat.phone).at(-1);
        return <button key={chat.phone} className={`chat-row ${active === chat.phone ? 'chat-row--active' : ''}`} onClick={() => { setActive(chat.phone); setSidebarOpen(false); setDraft(''); }}>
          <span className="avatar">{chat.phone.slice(-2)}</span><span className="chat-summary"><strong>+{chat.phone}</strong><small>{latest?.text || 'Новый чат'}</small></span><time>{latest ? formatTime(latest.timestamp) : ''}</time>
        </button>;
      }) : <div className="empty-list"><MessageCircle size={28}/><b>Чатов пока нет</b><p>Создайте чат, чтобы начать общение</p></div>}</div>
      <div className="sidebar-footer"><span className={`status-dot ${pollError ? 'status-dot--error' : ''}`}/>{pollError ? 'Переподключение…' : 'GREEN-API подключён'}</div>
    </aside>
    <main className={`conversation ${sidebarOpen ? 'conversation--hidden-mobile' : ''}`}>
      {active ? <>
        <header className="conversation-header"><button className="icon-button back-button" onClick={() => setSidebarOpen(true)} aria-label="К списку чатов"><ArrowLeft size={20}/></button><span className="avatar">{active.slice(-2)}</span><span className="conversation-contact"><b>+{active}</b><small><span className="status-dot"/> MAX · Личный чат</small></span><button className="icon-button" onClick={onLogout} aria-label="Отключиться"><LogOut size={18}/></button></header>
        <div className="message-list"><div className="date-divider">Сегодня</div>{!currentMessages.length && <div className="start-hint"><MessageCircle size={34}/><h3>Начните разговор</h3><p>Отправьте первое сообщение пользователю +{active}</p></div>}{currentMessages.map(message => <div className={`bubble-row bubble-row--${message.direction}`} key={message.id}><div className={`bubble bubble--${message.direction} ${message.status === 'failed' ? 'bubble--failed' : ''}`}><p>{message.text}</p><div className="bubble-meta"><time>{formatTime(message.timestamp)}</time>{message.direction === 'outgoing' && (message.status === 'sent' ? <CheckCheck size={14}/> : message.status === 'failed' ? <button onClick={() => { setMessages(old => old.map(item => item.id === message.id ? { ...item, status: 'sending' } : item)); void transmit(message); }}>Повторить</button> : <Check size={14}/>)}</div></div></div>)}<div ref={bottomRef}/></div>
        <form className="composer" onSubmit={send}><input aria-label="Сообщение" placeholder="Написать сообщение…" value={draft} onChange={event => setDraft(event.target.value)}/><button type="submit" aria-label="Отправить" disabled={!draft.trim()}><Send size={19}/></button></form>
      </> : <div className="welcome"><span className="welcome-mark"><MessageCircle size={47} fill="currentColor" /></span><h2>Ваши сообщения. Здесь.</h2><p>Выберите переписку или начните новый чат, чтобы оставаться на связи.</p><button className="primary-button" onClick={() => setDialogOpen(true)}><Plus size={18}/> Начать чат</button></div>}
      {pollError && <div className="connection-error" role="status"><WifiOff size={17}/> Нет связи с GREEN-API. Повторяем попытку: {pollError}</div>}
    </main>
    {dialogOpen && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><span className="card-icon"><Plus/></span><button className="icon-button" aria-label="Закрыть" onClick={() => setDialogOpen(false)}><X size={20}/></button></div><h2 id="modal-title">Новый чат</h2><p>Введите номер получателя в международном формате.</p><form onSubmit={event => void createChat(event)}><label htmlFor="recipient">Номер телефона</label><input id="recipient" autoFocus placeholder="+7 (999) 123-45-67" value={phone} onChange={event => { setPhone(event.target.value); setNewChatError(''); }}/>{newChatError && <div className="form-error" role="alert">{newChatError}</div>}<button className="primary-button" disabled={creating} type="submit">{creating ? 'Проверяем…' : 'Продолжить'} <ArrowRight size={18}/></button></form></section></div>}
  </div>;
}

export default function App() {
  const [client, setClient] = useState<GreenApi | null>(null);
  async function connect(credentials: Credentials) {
    const api = new GreenApi(credentials);
    const { stateInstance } = await api.getState();
    if (!['authorized', 'suspended'].includes(stateInstance)) throw new Error(`Инстанс не готов: ${stateInstance}. Авторизуйте его в кабинете GREEN-API.`);
    setClient(api);
  }
  return client ? <Chat client={client} onLogout={() => setClient(null)}/> : <Login onConnect={connect}/>;
}
