'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, Paperclip, Send } from 'lucide-react';
import { api, authedBlob } from '@/services/api';
import { useAuth } from '@/context/AppContext';
import { Avatar, Spinner } from '@/components/ui';
import { roleLabel } from '@/lib/format';
import type { ChatMessage, ChatPerson } from '@/types';

const MAX_FILE = 5 * 1024 * 1024;

function when(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileBubble({ message }: { message: ChatMessage }) {
  const file = message.file;
  const image = Boolean(file?.mimeType.startsWith('image/'));
  const [url, setUrl] = useState<string | null>(file?.url || null);

  useEffect(() => {
    if (!file || !image || file.url) return undefined;
    let alive = true;
    let objectUrl = '';
    authedBlob(`/chat/files/${message.id}`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, image, message.id]);

  if (!file) return null;

  const openFile = async () => {
    if (file.url) {
      window.open(file.url, '_blank', 'noopener');
      return;
    }
    const blob = await authedBlob(`/chat/files/${message.id}`);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.originalName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <button type="button" className="mb-1 block max-w-full text-left" onClick={() => { void openFile(); }}>
      {image && (file.url || url) ? <img src={file.url || url || ''} alt="" className="mb-1 max-h-52 rounded-md" /> : null}
      <span className="block truncate text-sm font-semibold underline">{file.originalName}</span>
      <span className="text-[11px] opacity-70">{sizeLabel(file.size)}</span>
    </button>
  );
}

export default function ChatPage() {
  const { toast, onSocket, emitSocket, setChatUnread, onlineIds } = useAuth();
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [threads, setThreads] = useState<ChatPerson[]>([]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [person, setPerson] = useState<ChatPerson | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const typingAt = useRef(0);
  const typingTimer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  useEffect(() => {
    Promise.all([
      api.get<ChatPerson[]>('/chat/threads'),
      api.get<ChatPerson[]>('/chat/people'),
    ]).then(([threadResult, peopleResult]) => {
      setThreads(threadResult.data);
      setPeople(peopleResult.data);
    }).catch((err: Error) => toast(err.message, 'err'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, typing, activeId]);

  useEffect(() => {
    const stopMessage = onSocket('chat:message', (payload) => {
      const message = payload as ChatMessage;
      const other = message.mine ? message.to : message.from;
      setThreads((current) => {
        const known = current.find((item) => item.id === other);
        const next: ChatPerson = {
          id: other,
          name: known?.name || message.fromName || 'Employee',
          role: known?.role || 'employee',
          department: known?.department,
          employeeCode: known?.employeeCode,
          online: known?.online,
          lastSeen: known?.lastSeen,
          unread: message.mine || activeRef.current === other ? 0 : (known?.unread || 0) + 1,
          lastBody: message.body,
          lastFile: message.file?.originalName || '',
          lastAt: message.createdAt,
          lastFromMe: message.mine,
        };
        return [next, ...current.filter((item) => item.id !== other)];
      });
      if (activeRef.current && (message.from === activeRef.current || message.to === activeRef.current)) {
        setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
        if (!message.mine) {
          void api.get(`/chat/${activeRef.current}`).then(() => api.get<{ count: number }>('/chat/unread'))
            .then((result) => setChatUnread(result.data.count || 0))
            .catch(() => undefined);
        }
      }
    });
    const stopRead = onSocket('chat:read', (payload) => {
      const data = payload as { with?: string; at?: string };
      if (!data.with || data.with !== activeRef.current || !data.at) return;
      setMessages((current) => current.map((item) => (item.mine && !item.readAt ? { ...item, readAt: data.at || item.readAt } : item)));
    });
    const stopPresence = onSocket('presence', (payload) => {
      const data = payload as { userId?: string; online?: boolean; lastSeen?: string | null };
      if (!data.userId) return;
      const apply = (item: ChatPerson) => (item.id === data.userId ? { ...item, online: Boolean(data.online), lastSeen: data.lastSeen } : item);
      setPeople((current) => current.map(apply));
      setThreads((current) => current.map(apply));
      setPerson((current) => (current && current.id === data.userId ? apply(current) : current));
    });
    const stopTyping = onSocket('chat:typing', (payload) => {
      const data = payload as { from?: string };
      if (!data.from || data.from !== activeRef.current) return;
      setTyping(true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setTyping(false), 1800);
    });
    return () => {
      stopMessage();
      stopRead();
      stopPresence();
      stopTyping();
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, [onSocket, setChatUnread]);

  async function openPerson(id: string) {
    setActiveId(id);
    setTyping(false);
    setOpening(true);
    setPerson(people.find((item) => item.id === id) || threads.find((item) => item.id === id) || null);
    try {
      const result = await api.get<{ person: ChatPerson; messages: ChatMessage[] }>(`/chat/${id}`);
      setPerson(result.data.person);
      setMessages(result.data.messages);
      setThreads((current) => current.map((item) => (item.id === id ? { ...item, unread: 0 } : item)));
      const unread = await api.get<{ count: number }>('/chat/unread');
      setChatUnread(unread.data.count || 0);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open the chat', 'err');
    } finally {
      setOpening(false);
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!activeId || sending) return;
    const text = draft.trim();
    if (!text && !file) return;
    if (file && file.size > MAX_FILE) {
      toast('File must be 5 MB or smaller', 'err');
      return;
    }
    const body = new FormData();
    if (text) body.append('body', text);
    if (file) body.append('file', file);
    setSending(true);
    try {
      const result = await api.form<ChatMessage>(`/chat/${activeId}`, body);
      setMessages((current) => (current.some((item) => item.id === result.data.id) ? current : [...current, result.data]));
      setDraft('');
      setFile(null);
      setThreads((current) => {
        const known = current.find((item) => item.id === activeId) || person;
        const next: ChatPerson = {
          id: activeId,
          name: known?.name || 'Employee',
          role: known?.role || 'employee',
          department: known?.department,
          employeeCode: known?.employeeCode,
          online: known?.online,
          lastSeen: known?.lastSeen,
          unread: 0,
          lastBody: result.data.body,
          lastFile: result.data.file?.originalName || '',
          lastAt: result.data.createdAt,
          lastFromMe: true,
        };
        return [next, ...current.filter((item) => item.id !== activeId)];
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send', 'err');
    } finally {
      setSending(false);
    }
  }

  function onDraft(value: string) {
    setDraft(value);
    if (!activeId) return;
    const now = Date.now();
    if (now - typingAt.current < 1200) return;
    typingAt.current = now;
    emitSocket('chat:typing', { to: activeId });
  }

  const q = query.trim().toLowerCase();
  const visibleThreads = useMemo(
    () => threads.filter((item) => !q || item.name.toLowerCase().includes(q)),
    [q, threads],
  );
  const threadIds = useMemo(() => new Set(threads.map((item) => item.id)), [threads]);
  const starters = people
    .filter((item) => !threadIds.has(item.id) && (!q || item.name.toLowerCase().includes(q)))
    .sort((a, b) => Number(onlineIds.includes(b.id) || b.online) - Number(onlineIds.includes(a.id) || a.online) || a.name.localeCompare(b.name));

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[540px] overflow-hidden border border-[#d1d7db] bg-[#efeae2]">
      <aside className={`${activeId ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-[#d1d7db] bg-white md:w-[340px]`}>
        <div className="border-b border-[#d1d7db] bg-[#f0f2f5] px-4 py-3">
          <h1 className="text-lg font-bold text-[#111b21]">Chat</h1>
          <p className="text-xs text-[#667781]">Messages stay live. Files up to 5 MB.</p>
          <input
            className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm outline-none"
            placeholder="Search people"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="sidebar-scroll flex-1 overflow-y-auto">
          {loading ? <Spinner label="Loading chats" /> : (
            <>
              {visibleThreads.map((item) => (
                <PersonRow key={item.id} person={item} active={item.id === activeId} online={onlineIds.includes(item.id) || Boolean(item.online)} onClick={() => { void openPerson(item.id); }} />
              ))}
              {starters.length > 0 && <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#667781]">People</p>}
              {starters.map((item) => (
                <PersonRow key={item.id} person={item} active={item.id === activeId} online={onlineIds.includes(item.id) || Boolean(item.online)} onClick={() => { void openPerson(item.id); }} />
              ))}
              {visibleThreads.length === 0 && starters.length === 0 && (
                <p className="px-4 py-6 text-sm text-[#667781]">No one matches that search.</p>
              )}
            </>
          )}
        </div>
      </aside>
      <section className={`${activeId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {!activeId || !person ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <p className="text-2xl font-semibold text-[#41525d]">WorkTrack chat</p>
              <p className="mt-2 text-sm text-[#667781]">Pick a person. Messages and files show up as they are sent.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5">
              <button type="button" className="text-sm font-semibold text-[#0f766e] md:hidden" onClick={() => { setActiveId(null); setPerson(null); }}>Back</button>
              <Avatar name={person.name} online={onlineIds.includes(person.id) || Boolean(person.online)} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#111b21]">{person.name}</p>
                <p className={`truncate text-xs ${typing ? 'text-[#667781]' : (onlineIds.includes(person.id) || person.online) ? 'font-semibold text-[#25d366]' : 'text-[#667781]'}`}>
                  {typing ? 'typing…' : (onlineIds.includes(person.id) || person.online) ? 'online' : person.lastSeen ? `last seen ${when(person.lastSeen)}` : 'offline'}
                </p>
              </div>
            </header>
            <div ref={scroller} className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {opening ? <Spinner label="Opening chat" /> : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#667781]">Say hello. You can also share a file up to 5 MB.</p>
              ) : messages.map((message, index) => {
                const previous = messages[index - 1];
                const showDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                return (
                  <div key={message.id}>
                    {showDay && <p className="my-2 text-center text-[11px] font-semibold text-[#667781]"><span className="rounded-md bg-white px-2 py-1 shadow-sm">{dayLabel(message.createdAt)}</span></p>}
                    <div className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[min(80%,28rem)] rounded-lg px-2.5 py-1.5 shadow-sm ${message.mine ? 'bg-[#d9fdd3] text-[#111b21]' : 'bg-white text-[#111b21]'}`}>
                        <FileBubble message={message} />
                        {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
                        <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                          <span>{when(message.createdAt)}</span>
                          {message.mine && (message.readAt ? <CheckCheck size={13} className="text-[#53bdeb]" /> : <Check size={13} />)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typing && <p className="text-xs text-[#667781]">typing…</p>}
            </div>
            <form className="flex items-end gap-2 border-t border-[#d1d7db] bg-[#f0f2f5] px-3 py-2" onSubmit={send}>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const next = event.target.files?.[0] || null;
                  if (next && next.size > MAX_FILE) {
                    toast('File must be 5 MB or smaller', 'err');
                    event.target.value = '';
                    return;
                  }
                  setFile(next);
                }}
              />
              <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-black/5" aria-label="Attach a file" onClick={() => fileRef.current?.click()}>
                <Paperclip size={18} />
              </button>
              <div className="min-w-0 flex-1">
                {file && (
                  <p className="mb-1 flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-xs">
                    <span className="truncate">{file.name} · {sizeLabel(file.size)}</span>
                    <button type="button" className="font-semibold text-rose-700" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>
                  </p>
                )}
                <textarea
                  rows={1}
                  className="max-h-28 w-full resize-none rounded-lg bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Message"
                  value={draft}
                  onChange={(event) => onDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
              </div>
              <button type="submit" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0f766e] text-white disabled:opacity-50" aria-label="Send" disabled={sending || (!draft.trim() && !file)}>
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function PersonRow({ person, active, onClick, online }: { person: ChatPerson; active: boolean; onClick: () => void; online: boolean }) {
  const preview = person.lastFile ? `File · ${person.lastFile}` : (person.lastBody || person.designation || roleLabel(person.role));
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-[#f0f2f5] px-3 py-2.5 text-left ${active ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}>
      <Avatar name={person.name} online={online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-[#111b21]">{person.name}</span>
          <span className="shrink-0 text-[11px] text-[#667781]">{when(person.lastAt)}</span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-[#667781]">{person.lastFromMe ? `You: ${preview}` : preview}</span>
          {(person.unread || 0) > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#25d366] px-1 text-[11px] font-bold text-white">{person.unread}</span>}
        </span>
      </span>
    </button>
  );
}
