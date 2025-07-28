import { create } from "zustand";

// ==============================
// ✅ Type Definitions
// ==============================

export type WebSocketEventType =
  | "chat"
  | "notif"
  | "read"
  | "typing"
  | "stopTyping"
  | "online"
  | "offline"
  | "onlineUsers";

export interface ChatMessage {
  from: string;
  to: string;
  message: string;
  timestamp?: string;
  read?: boolean;
}

export interface NotificationData {
  from: string;
  to: string;
  message: string;
  type?: string; // e.g., "mention", "newMessage"
  timestamp?: string;
  read?: boolean;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
}

export interface WebSocketPayload<T = any> {
  event: WebSocketEventType;
  data: T;
}

// ==============================
// ✅ Zustand Store Interface
// ==============================

interface ChatStore {
  socket: WebSocket | null;

  chats: ChatMessage[];
  notifs: NotificationData[];
  onlineUsers: string[];
  typingUsers: TypingStatus[];

  // Socket control
  setSocket: (sock: WebSocket) => void;

  // Chat
  addChat: (msg: ChatMessage) => void;
  setChats: (data: ChatMessage[]) => void;
  markMessageRead: (fromUserId: string) => void;

  // Notif
  addNotif: (n: NotificationData) => void;
  setNotifs: (data: NotificationData[]) => void;
  markNotifRead: (fromUserId: string) => void;

  // Typing
  setTyping: (status: TypingStatus) => void;

  // Online user
  setOnlineUsers: (users: string[]) => void;
}

// ==============================
// ✅ Zustand Implementation
// ==============================

export const useChatStore = create<ChatStore>((set) => ({
  socket: null,

  chats: [],
  notifs: [],
  onlineUsers: [],
  typingUsers: [],

  // ====== SOCKET ======
  setSocket: (sock) => set({ socket: sock }),

  // ====== CHAT ======
  addChat: (msg) => set((state) => ({ chats: [...state.chats, msg] })),
  setChats: (data) => set({ chats: data }),

  markMessageRead: (fromUserId) =>
    set((state) => ({
      chats: state.chats.map((msg) =>
        msg.from === fromUserId ? { ...msg, read: true } : msg
      ),
    })),

  // ====== NOTIF ======
  addNotif: (n) => set((state) => ({ notifs: [...state.notifs, n] })),
  setNotifs: (data) => set({ notifs: data }),

  markNotifRead: (fromUserId) =>
    set((state) => ({
      notifs: state.notifs.map((n) =>
        n.from === fromUserId ? { ...n, read: true } : n
      ),
    })),

  // ====== TYPING ======
  setTyping: (status) =>
    set((state) => {
      const isExist = state.typingUsers.find(
        (t) => t.userId === status.userId
      );
      if (status.isTyping && !isExist) {
        return {
          typingUsers: [...state.typingUsers, status],
        };
      } else if (!status.isTyping) {
        return {
          typingUsers: state.typingUsers.filter(
            (t) => t.userId !== status.userId
          ),
        };
      }
      return {};
    }),

  // ====== ONLINE USERS ======
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}));
