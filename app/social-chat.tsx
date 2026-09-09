'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ShieldBan } from 'lucide-react';
import { accountApi, useAccount } from './account-context';
import './live-platform.css';
type Friend = {
  id: string;
  name: string;
  handle: string;
  activity: string;
  updated_at: number;
  blocked: number;
};
type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: number;
};
export default function SocialChat() {
  const { data } = useAccount(),
    [friends, setFriends] = useState<Friend[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [target, setTarget] = useState(''),
    [draft, setDraft] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const key = useRef('');
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await accountApi<{ friends: Friend[]; messages: Message[] }>(
          undefined,
          '?action=social&target=' + encodeURIComponent(target),
        );
        if (!cancelled) {
          setFriends(r.friends);
          setMessages(r.messages);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [data?.player.id, target]);
  useEffect(() => {
    if (!data) return;
    const heartbeat = () => {
      if (!document.hidden)
        void accountApi({ action: 'presence', activity: 'lobby' }).catch(
          () => {},
        );
    };
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    return () => clearInterval(timer);
  }, [data?.player.id]);
  async function send() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError('');
    key.current ||= crypto.randomUUID();
    try {
      await accountApi({
        action: 'message_send',
        target,
        message: draft,
        key: key.current,
      });
      key.current = '';
      setDraft('');
      const r = await accountApi<{ messages: Message[] }>(
        undefined,
        '?action=social&target=' + encodeURIComponent(target),
      );
      setMessages(r.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function block(friend: Friend) {
    try {
      await accountApi({
        action: friend.blocked ? 'player_unblock' : 'player_block',
        target: friend.id,
      });
      setTarget('');
      setFriends((items) =>
        items.map((p) =>
          p.id === friend.id ? { ...p, blocked: 1 - p.blocked } : p,
        ),
      );
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data) return null;
  return (
    <section className="account-panel social-panel">
      <h2>
        <MessageSquare size={20} /> FRIEND MESSAGES
      </h2>
      <p>
        Chat with accepted friends. Presence updates while this page is open.
      </p>
      <div className="social-layout">
        <div className="conversation-list">
          {friends.length ? (
            friends.map((friend) => (
              <div className="conversation-person" key={friend.id}>
                <button
                  disabled={!!friend.blocked}
                  className={target === friend.id ? 'selected' : ''}
                  onClick={() => {
                    setTarget(friend.id);
                    setMessages([]);
                    setDraft('');
                    key.current = '';
                  }}
                >
                  <b>{friend.name}</b>
                  <span>
                    <i
                      className={
                        Date.now() - friend.updated_at < 70000 ? 'online' : ''
                      }
                    />
                    {friend.blocked
                      ? 'Blocked'
                      : Date.now() - friend.updated_at < 70000
                        ? friend.activity
                        : 'Offline'}
                  </span>
                </button>
                <button
                  aria-label={`${friend.blocked ? 'Unblock' : 'Block'} ${friend.name}`}
                  onClick={() => void block(friend)}
                >
                  <ShieldBan size={16} />
                </button>
              </div>
            ))
          ) : (
            <p>Add a friend above to start a conversation.</p>
          )}
        </div>
        <div className="conversation">
          <div className="message-list" role="log" aria-label="Messages">
            {!target ? (
              <div className="platform-empty">
                <MessageSquare />
                <p>Choose a friend to start chatting.</p>
              </div>
            ) : messages.length ? (
              messages.map((m) => (
                <div
                  className={
                    m.sender_id === data.player.id
                      ? 'message-bubble mine'
                      : 'message-bubble'
                  }
                  key={m.id}
                >
                  <p>{m.body}</p>
                  <small>
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </div>
              ))
            ) : (
              <p>No messages yet. Say hello.</p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              aria-label="Message"
              placeholder="Write a message…"
              maxLength={500}
              value={draft}
              disabled={!target || busy}
              onChange={(e) => {
                setDraft(e.target.value);
                key.current = '';
              }}
            />
            <button
              className="primary"
              aria-label="Send message"
              disabled={!target || busy || !draft.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
