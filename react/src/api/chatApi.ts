import axios from "axios";
import type { ChatMessage, NotificationData } from "../zustand/useChatStore";

export const getAllChats = async (): Promise<ChatMessage[]> => {
  const res = await axios.get("/api/chats");
  return res.data;
};

export const getAllNotifs = async (): Promise<NotificationData[]> => {
  const res = await axios.get("/api/notifs");
  return res.data;
};
