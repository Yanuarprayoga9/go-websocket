import './App.css'
import React, { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Bell, Send, MessageCircle, Wifi, WifiOff, User, Users, CheckCheck, Check, Eye } from 'lucide-react';

// Types
interface Message {
  id: number;
  from: string;
  to: string;
  message: string;
  read: boolean;
  timestamp: string;
}

interface Envelope {
  event: string;
  data: any;
}

interface ChatState {
  currentUser: string;
  selectedChat: string;
  messages: Message[];
  notifications: Message[];
  onlineUsers: string[];
  isConnected: boolean;
  socket: WebSocket | null;
  typingUsers: string[];
  unreadCount: number;
  
  // Actions
  setCurrentUser: (user: string) => void;
  setSelectedChat: (user: string) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  addNotification: (message: Message) => void;
  setNotifications: (notifications: Message[]) => void;
  markAsRead: (from: string) => void;
  setOnlineUsers: (users: string[]) => void;
  addOnlineUser: (user: string) => void;
  removeOnlineUser: (user: string) => void;
  setConnected: (connected: boolean) => void;
  setSocket: (socket: WebSocket | null) => void;
  addTypingUser: (user: string) => void;
  removeTypingUser: (user: string) => void;
  clearChat: () => void;
}

// Zustand Store
const useChatStore = create<ChatState>((set, get) => ({
  currentUser: '',
  selectedChat: '',
  messages: [],
  notifications: [],
  onlineUsers: [],
  isConnected: false,
  socket: null,
  typingUsers: [],
  unreadCount: 0,

  setCurrentUser: (user) => set({ currentUser: user }),
  setSelectedChat: (user) => set({ selectedChat: user }),
  
  addMessage: (message) => {
    set((state) => {
      const exists = state.messages.find(m => m.id === message.id);
      if (exists) return state;
      
      return {
        messages: [...state.messages, message],
      };
    });
  },
  
  setMessages: (messages) => set({ messages }),
  
  addNotification: (message) => {
    set((state) => {
      const exists = state.notifications.find(n => n.id === message.id);
      if (exists) return state;
      
      return {
        notifications: [...state.notifications, message],
        unreadCount: state.unreadCount + 1
      };
    });
  },
  
  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter(n => !n.read).length
  }),
  
  markAsRead: (from) => {
    set((state) => ({
      messages: state.messages.map(m => 
        m.from === from && m.to === state.currentUser ? { ...m, read: true } : m
      ),
      notifications: state.notifications.map(n => 
        n.from === from ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - state.notifications.filter(n => n.from === from && !n.read).length)
    }));
  },
  
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  addOnlineUser: (user) => set((state) => ({
    onlineUsers: [...new Set([...state.onlineUsers, user])]
  })),
  removeOnlineUser: (user) => set((state) => ({
    onlineUsers: state.onlineUsers.filter(u => u !== user)
  })),
  
  setConnected: (connected) => set({ isConnected: connected }),
  setSocket: (socket) => set({ socket }),
  
  addTypingUser: (user) => set((state) => ({
    typingUsers: [...new Set([...state.typingUsers, user])]
  })),
  removeTypingUser: (user) => set((state) => ({
    typingUsers: state.typingUsers.filter(u => u !== user)
  })),
  
  clearChat: () => set({ messages: [], notifications: [], unreadCount: 0 }),
}));

const ChatApp: React.FC = () => {
  const {
    currentUser,
    selectedChat,
    messages,
    notifications,
    onlineUsers,
    isConnected,
    socket,
    typingUsers,
    unreadCount,
    setCurrentUser,
    setSelectedChat,
    addMessage,
    setMessages,
    addNotification,
    setNotifications,
    markAsRead,
    addOnlineUser,
    removeOnlineUser,
    setConnected,
    setSocket,
    addTypingUser,
    removeTypingUser,
    clearChat
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto remove typing indicator after 3 seconds
  useEffect(() => {
    if (typingUsers.length > 0) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        typingUsers.forEach(user => removeTypingUser(user));
      }, 3000);
    }
  }, [typingUsers, removeTypingUser]);

  const connectWebSocket = () => {
    if (!loginUser.trim()) {
      alert('Please enter a username first!');
      return;
    }

    try {
      const ws = new WebSocket(`ws://localhost:8080/ws?userId=${loginUser}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setSocket(ws);
        setCurrentUser(loginUser);
        
        // Get notifications when connected
        ws.send(JSON.stringify({
          event: 'getNotif',
          data: {}
        }));
      };

      ws.onmessage = (event) => {
        const envelope: Envelope = JSON.parse(event.data);
        console.log('Received:', envelope);

        switch (envelope.event) {
          case 'chat':
            const message: Message = envelope.data;
            addMessage(message);
            if (message.to === currentUser) {
              addNotification(message);
            }
            break;

          case 'read':
            const readData = envelope.data;
            markAsRead(readData.from);
            break;

          case 'typing':
            const typingData = envelope.data;
            addTypingUser(typingData.from);
            break;

          case 'getChats':
            const chatMessages: Message[] = envelope.data || [];
            setMessages(chatMessages);
            break;

          case 'getNotif':
            const notifMessages: Message[] = envelope.data || [];
            setNotifications(notifMessages);
            break;

          case 'online':
            const onlineData = envelope.data;
            addOnlineUser(onlineData.userId);
            break;

          case 'offline':
            const offlineData = envelope.data;
            removeOnlineUser(offlineData.userId);
            break;
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        setSocket(null);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
        setSocket(null);
      };

    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (socket) {
      socket.close();
    }
  };

  const sendMessage = () => {
    if (!socket || !inputMessage.trim() || !selectedChat) return;

    const chatPayload = {
      event: 'chat',
      data: {
        from: currentUser,
        to: selectedChat,
        message: inputMessage.trim()
      }
    };

    socket.send(JSON.stringify(chatPayload));
    
    // Add to local messages
    const localMessage: Message = {
      id: Date.now(),
      from: currentUser,
      to: selectedChat,
      message: inputMessage.trim(),
      read: false,
      timestamp: new Date().toISOString()
    };
    addMessage(localMessage);
    setInputMessage('');
  };

  const selectChat = (user: string) => {
    if (!socket) return;
    
    setSelectedChat(user);
    
    // Get chat history
    socket.send(JSON.stringify({
      event: 'getChats',
      data: {
        user1: currentUser,
        user2: user
      }
    }));

    // Mark as read
    socket.send(JSON.stringify({
      event: 'read',
      data: {
        from: user,
        to: currentUser
      }
    }));
    
    markAsRead(user);
  };

  const handleTyping = () => {
    if (!socket || !selectedChat) return;
    
    socket.send(JSON.stringify({
      event: 'typing',
      data: {
        from: currentUser,
        to: selectedChat
      }
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    } else {
      handleTyping();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getFilteredMessages = () => {
    return messages.filter(m => 
      (m.from === currentUser && m.to === selectedChat) ||
      (m.from === selectedChat && m.to === currentUser)
    );
  };

  const getUnreadCount = (user: string) => {
    return notifications.filter(n => n.from === user && !n.read).length;
  };

  // Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <MessageCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Chat App</h1>
            <p className="text-gray-600">Enter your username to start chatting</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              placeholder="Enter username..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && connectWebSocket()}
            />
            
            <button
              onClick={connectWebSocket}
              disabled={!loginUser.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Connect
            </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500 text-center">
            <p>💡 Make sure Go server is running on localhost:8080</p>
            <p>Try usernames: alice, bob, charlie</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - User List */}
      <div className="w-80 bg-white border-r shadow-sm flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-800">{currentUser}</span>
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={disconnectWebSocket}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Online Users */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Online Users ({onlineUsers.length})
            </h3>
            
            <div className="space-y-2">
              {onlineUsers.filter(u => u !== currentUser).map(user => (
                <button
                  key={user}
                  onClick={() => selectChat(user)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedChat === user 
                      ? 'bg-blue-100 border-blue-300 border' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{user}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {getUnreadCount(user) > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {getUnreadCount(user)}
                        </span>
                      )}
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            {onlineUsers.filter(u => u !== currentUser).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No other users online</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white shadow-sm border-b p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {selectedChat.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedChat}</h2>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Online</span>
                    {typingUsers.includes(selectedChat) && (
                      <span className="text-sm text-blue-600 italic">typing...</span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={clearChat}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              >
                Clear Chat
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {getFilteredMessages().map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.from === currentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.from === currentUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border shadow-sm text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${
                        message.from === currentUser ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                      {message.from === currentUser && (
                        <div className="ml-2">
                          {message.read ? (
                            <CheckCheck className="w-3 h-3 text-blue-200" />
                          ) : (
                            <Check className="w-3 h-3 text-blue-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t p-4">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${selectedChat}...`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No chat selected</h3>
              <p>Choose a user from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Notifications Sidebar */}
      {showNotifications && (
        <div className="w-80 bg-white border-l shadow-lg">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </h2>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded"
              >
                ×
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y">
                {notifications.slice().reverse().map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => selectChat(notification.from)}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {notification.from.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{notification.from}</span>
                      {!notification.read && <Eye className="w-3 h-3 text-blue-500" />}
                    </div>
                    <p className="text-sm text-gray-700 truncate">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatApp;