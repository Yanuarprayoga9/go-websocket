package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ------------------------ Struct ------------------------

type Envelope struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type ChatPayload struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Message string `json:"message"`
}

type ReadPayload struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type TypingPayload struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type GetChatsPayload struct {
	User1 string `json:"user1"`
	User2 string `json:"user2"`
}

type Message struct {
	ID        int       `json:"id"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Text      string    `json:"message"`
	Read      bool      `json:"read"`
	Timestamp time.Time `json:"timestamp"`
}

// ------------------------ Global ------------------------

var (
	messageID   = 1
	allMessages []Message
	clients     = map[string]*websocket.Conn{}
	onlineUsers = map[string]bool{}
	lock        sync.RWMutex
	upgrader    = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
)

// ------------------------ WebSocket Handler ------------------------

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		http.Error(w, "Missing userId", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	lock.Lock()
	clients[userId] = conn
	onlineUsers[userId] = true
	lock.Unlock()

	broadcastEvent("online", map[string]string{"userId": userId})

	fmt.Println("User connected:", userId)

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var env Envelope
		if err := json.Unmarshal(raw, &env); err != nil {
			continue
		}

		switch env.Event {
		case "chat":
			handleChat(env.Data)
		case "read":
			handleRead(env.Data)
		case "typing":
			handleTyping(env.Data)
		case "getChats":
			handleGetChats(conn, env.Data)
		case "getNotif":
			handleGetNotif(conn, userId)
		}
	}

	lock.Lock()
	delete(clients, userId)
	delete(onlineUsers, userId)
	lock.Unlock()

	broadcastEvent("offline", map[string]string{"userId": userId})
}

// ------------------------ Handlers ------------------------

func handleChat(data json.RawMessage) {
	var p ChatPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return
	}

	lock.Lock()
	msg := Message{
		ID:        messageID,
		From:      p.From,
		To:        p.To,
		Text:      p.Message,
		Timestamp: time.Now(),
		Read:      false,
	}
	messageID++
	allMessages = append(allMessages, msg)
	lock.Unlock()

	// Kirim ke penerima jika online
	lock.RLock()
	toConn := clients[p.To]
	lock.RUnlock()
	if toConn != nil {
		toConn.WriteJSON(Envelope{Event: "chat", Data: toJSONRaw(msg)})
	}
}

func handleRead(data json.RawMessage) {
	var p ReadPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return
	}

	lock.Lock()
	for i := range allMessages {
		if allMessages[i].From == p.From && allMessages[i].To == p.To {
			allMessages[i].Read = true
		}
	}
	lock.Unlock()

	// Kirim ke pengirim bahwa pesan sudah dibaca
	lock.RLock()
	fromConn := clients[p.From]
	lock.RUnlock()
	if fromConn != nil {
		fromConn.WriteJSON(Envelope{Event: "read", Data: toJSONRaw(p)})
	}
}

func handleTyping(data json.RawMessage) {
	var p TypingPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return
	}

	lock.RLock()
	toConn := clients[p.To]
	lock.RUnlock()
	if toConn != nil {
		toConn.WriteJSON(Envelope{Event: "typing", Data: toJSONRaw(map[string]string{
			"from": p.From,
		})})
	}
}

func handleGetChats(conn *websocket.Conn, data json.RawMessage) {
	var p GetChatsPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return
	}

	var chatList []Message
	lock.RLock()
	for _, m := range allMessages {
		if (m.From == p.User1 && m.To == p.User2) || (m.From == p.User2 && m.To == p.User1) {
			chatList = append(chatList, m)
		}
	}
	lock.RUnlock()

	conn.WriteJSON(Envelope{Event: "getChats", Data: toJSONRaw(chatList)})
}

func handleGetNotif(conn *websocket.Conn, userId string) {
	var notif []Message
	lock.RLock()
	for _, m := range allMessages {
		if m.To == userId && !m.Read {
			notif = append(notif, m)
		}
	}
	lock.RUnlock()

	conn.WriteJSON(Envelope{Event: "getNotif", Data: toJSONRaw(notif)})
}

// ------------------------ Utility ------------------------

func broadcastEvent(event string, payload any) {
	lock.RLock()
	for _, conn := range clients {
		conn.WriteJSON(Envelope{Event: event, Data: toJSONRaw(payload)})
	}
	lock.RUnlock()
}

func toJSONRaw(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

// ------------------------ Main ------------------------

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	fmt.Println("Server listening on :8080")
	http.ListenAndServe(":8080", nil)
}
