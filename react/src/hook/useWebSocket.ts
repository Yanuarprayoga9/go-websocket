import { useEffect } from "react";
import { useChatStore } from "../zustand/useChatStore";

export function useWebSocket(userId: string) {
  const { setSocket, addChat, addNotif, setOnlineUsers } = useChatStore();

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws");

    socket.onopen = () => {
      setSocket(socket);
      socket.send(JSON.stringify({ event: "online", data: { userId } }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.event) {
        case "chat":
          addChat(msg.data);
          break;
        case "notif":
          addNotif(msg.data);
          break;
        case "onlineUsers":
          setOnlineUsers(msg.data);
          break;
        case "read":
          console.log("Pesan dibaca", msg.data);
          break;
      }
    };

    socket.onclose = () => {
      socket.send(JSON.stringify({ event: "offline", data: { userId } }));
    };

    return () => socket.close();
  }, [userId]);
}
