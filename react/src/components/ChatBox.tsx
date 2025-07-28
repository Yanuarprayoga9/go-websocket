import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChatStore } from "../zustand/useChatStore";
import { getAllChats } from "../api/chatApi";

export const ChatBox = () => {
      const { setSocket, addChat, addNotif, setOnlineUsers } = useChatStore();

  const [input, setInput] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [myChats, setMyChats] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["chats"],
    queryFn: getAllChats,
    onSuccess: (data) => {
      data.forEach(addChat);
    },
  });

  // subscribe to chats
  useEffect(() => {
    const unsub = chats.subscribe((c) =>
      setMyChats(c.map((msg) => `${msg.from}: ${msg.message}`))
    );
    return unsub;
  }, []);

  // handle ws
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");
    ws.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.event === "chat") {
        addChat(payload.data);
      }
    };
    setWs(ws);
    socket.set(ws);

    return () => ws.close();
  }, []);

  const send = () => {
    if (input && ws) {
      const message = {
        event: "chat",
        data: {
          from: "me",
          to: "user123",
          message: input,
        },
      };
      ws.send(JSON.stringify(message));
      setInput("");
    }
  };

  return (
    <div className="border p-4 rounded w-full max-w-md mx-auto my-4">
      <h2 className="font-bold text-lg">💬 Chat</h2>
      <div className="h-40 overflow-y-auto border my-2 p-2 bg-gray-50">
        {myChats.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="border p-1 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message"
        />
        <button onClick={send} className="bg-blue-500 text-white px-3 py-1 rounded">
          Send
        </button>
      </div>
    </div>
  );
};
