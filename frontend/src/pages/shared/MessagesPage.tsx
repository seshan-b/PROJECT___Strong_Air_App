// pages/shared/MessagesPage.tsx
// The internal messaging screen, used by both admins and workers.
//
// How messaging works in this app:
//   - Messages are organised into threads (like email threads). Each thread has
//     a subject, a list of participants, and a sequence of messages inside it.
//   - The left panel lists all threads the current user is part of, with an
//     unread count badge on each. Clicking a thread opens it on the right.
//   - Opening a thread fetches all messages in that thread and marks them as
//     read (the backend handles this automatically on fetch).
//   - The right panel shows the conversation. Your own messages appear on the
//     right (dark background); others' messages appear on the left (light).
//   - A reply box at the bottom lets you send a new message to the thread.
//   - The "New Message" button opens a modal where you pick recipients
//     (everyone except yourself), write a subject and first message, then send.
//   - On mobile, the thread list and message detail are shown one at a time,
//     with a back arrow to return to the list.
//
// This single component is shared between /admin/messages and /worker/messages.

import React, { useCallback, useEffect, useState } from 'react';
import { messagesApi, usersApi } from '../../api/client';
import { Send, MessageSquare, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import { formatDate, formatDateTime } from '../../utils/date';
import type { MessageThread, Message, User } from '../../types';

interface MessagesPageProps {
  currentUser: User;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ currentUser }) => {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ subject: '', body: '', recipient_ids: [] as number[] });
  const [users, setUsers] = useState<User[]>([]);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await messagesApi.threads();
      setThreads(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.directory();
      setUsers(res.data.filter(u => u.id !== currentUser.id));
    } catch (err) { console.error(err); }
  }, [currentUser.id]);

  useEffect(() => {
    fetchThreads();
    fetchUsers();
    // Poll for new threads every 30 seconds so the list stays current without a manual refresh
    const interval = setInterval(fetchThreads, 30000);
    return () => clearInterval(interval);
  }, [fetchThreads, fetchUsers]);

  const openThread = async (threadId: number) => {
    setSelectedThread(threadId);
    try {
      const res = await messagesApi.threadMessages(threadId);
      setMessages(res.data);
      fetchThreads(); // refresh unread counts
    } catch (err) { console.error(err); }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !reply.trim()) return;
    try {
      await messagesApi.reply(selectedThread, reply);
      setReply('');
      openThread(selectedThread);
    } catch (err) { console.error(err); }
  };

  const handleNewThread = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await messagesApi.createThread(newForm);
      setShowNew(false);
      setNewForm({ subject: '', body: '', recipient_ids: [] });
      fetchThreads();
      openThread(res.data.id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteThread = async (e: React.MouseEvent, threadId: number) => {
    e.stopPropagation();
    try {
      await messagesApi.deleteThread(threadId);
      if (selectedThread === threadId) {
        setSelectedThread(null);
        setMessages([]);
      }
      fetchThreads();
    } catch (err) { console.error(err); }
  };

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div className="animate-fade-in" data-testid="messages-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary-900">Messages</h1>
          <p className="text-primary-500 text-sm mt-1">
            {totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <button
          data-testid="new-message-button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-600 transition-colors"
        >
          <Plus size={16} /> New Message
        </button>
      </div>

      <div className="bg-white rounded-lg border border-primary-200 shadow-sm flex" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Thread List */}
        <div className={`border-r border-primary-200 overflow-y-auto ${selectedThread ? 'hidden md:block w-80' : 'w-full md:w-80'}`}>
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`group relative border-b border-primary-100 ${
                selectedThread === thread.id ? 'bg-accent/5 border-l-4 border-l-accent' : ''
              }`}
            >
              <button
                data-testid={`thread-${thread.id}`}
                onClick={() => openThread(thread.id)}
                className="w-full text-left px-4 py-4 hover:bg-primary-50 transition-colors pr-10"
              >
                <div className="flex items-start justify-between">
                  <p className="font-medium text-sm text-primary-900 truncate pr-2">{thread.subject || 'No subject'}</p>
                  {thread.unread_count > 0 && (
                    <span className="bg-accent text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0" data-testid={`unread-badge-${thread.id}`}>
                      {thread.unread_count}
                    </span>
                  )}
                </div>
                {thread.last_message && (
                  <p className="text-xs text-primary-400 mt-1 truncate">{thread.last_message.sender_name}: {thread.last_message.body}</p>
                )}
                <p className="text-xs text-primary-300 mt-1">{formatDate(thread.created_at)}</p>
              </button>
              <button
                data-testid={`delete-thread-${thread.id}`}
                onClick={(e) => handleDeleteThread(e, thread.id)}
                className="absolute top-3 right-3 p-1.5 text-primary-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                title="Delete thread"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {threads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-primary-400 py-12">
              <MessageSquare size={32} className="mb-3 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className={`flex-1 flex flex-col ${selectedThread ? 'block' : 'hidden md:flex'}`}>
          {selectedThread ? (
            <>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-primary-200">
                <button
                  data-testid="back-to-threads"
                  onClick={() => setSelectedThread(null)}
                  className="md:hidden p-1.5 text-primary-500 hover:text-primary-700"
                >
                  <ArrowLeft size={18} />
                </button>
                <h3 className="font-heading font-semibold text-primary-900">
                  {threads.find(t => t.id === selectedThread)?.subject || 'Thread'}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-testid="messages-list">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    data-testid={`message-${msg.id}`}
                    className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg px-4 py-3 ${
                      msg.sender_id === currentUser.id
                        ? 'bg-primary-900 text-white'
                        : 'bg-primary-50 text-primary-900'
                    }`}>
                      <p className={`text-xs font-medium mb-1 ${msg.sender_id === currentUser.id ? 'text-primary-300' : 'text-accent'}`}>
                        {msg.sender_name}
                      </p>
                      <p className="text-sm">{msg.body}</p>
                      <p className={`text-xs mt-1 ${msg.sender_id === currentUser.id ? 'text-primary-400' : 'text-primary-400'}`}>
                        {formatDateTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleReply} className="px-6 py-4 border-t border-primary-200 flex gap-3">
                <input
                  data-testid="reply-input"
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button data-testid="send-reply-button" type="submit" className="h-10 px-4 bg-accent text-white rounded-md hover:bg-accent-600 transition-colors">
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-primary-400">
              <div className="text-center">
                <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="new-message-modal">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fade-in">
            <h3 className="font-heading font-semibold text-lg text-primary-900 mb-4">New Message</h3>
            <form onSubmit={handleNewThread} className="space-y-4">
              <input data-testid="new-subject-input" type="text" placeholder="Subject" value={newForm.subject} onChange={(e) => setNewForm(p => ({ ...p, subject: e.target.value }))} className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent" required />

              <div>
                <p className="text-sm font-medium text-primary-700 mb-2">Recipients</p>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-primary-200 rounded-md p-2">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 p-2 rounded hover:bg-primary-50 cursor-pointer text-sm" data-testid={`recipient-${user.id}`}>
                      <input
                        type="checkbox"
                        checked={newForm.recipient_ids.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewForm(p => ({ ...p, recipient_ids: [...p.recipient_ids, user.id] }));
                          else setNewForm(p => ({ ...p, recipient_ids: p.recipient_ids.filter(id => id !== user.id) }));
                        }}
                        className="rounded border-primary-300 text-accent focus:ring-accent"
                      />
                      <span className="text-primary-800 flex-1">{user.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.role === 'superadmin'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-primary-100 text-primary-500'
                      }`}>
                        {user.role === 'superadmin' ? 'Admin' : 'Worker'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <textarea data-testid="new-body-input" placeholder="Write your message..." value={newForm.body} onChange={(e) => setNewForm(p => ({ ...p, body: e.target.value }))} className="w-full px-4 py-3 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" rows={4} required />

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 h-10 border border-primary-200 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-50">Cancel</button>
                <button data-testid="send-new-message-button" type="submit" disabled={newForm.recipient_ids.length === 0} className="flex-1 h-10 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-600 disabled:opacity-50">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
