
# 📦 Chat App - Refresh Strategy (WebSocket & REST)

Dalam aplikasi chat real-time, menjaga data tetap **up-to-date** sangat penting agar pengguna merasakan pengalaman yang **interaktif dan responsif**. File ini menjelaskan **kapan dan bagaimana komponen-komponen penting dalam chat perlu diperbarui**, baik menggunakan WebSocket, REST API, maupun polling.

## 🔄 Daftar Komponen yang Perlu Refresh

### ✅ 1. Chat List (Inbox / Room List)
**Perlu refresh saat:**
- Menerima pesan baru dari user lain
- User mengirim pesan (update `lastMessage`)
- Urutan chat berubah (karena recent activity)
- Notifikasi "unread" berubah

**Cara refresh:**
- **WebSocket:** Event `chat` atau `notif`
- **REST API:** Polling ulang `/api/chat-list`

### ✅ 2. Chat Detail (Isi Obrolan)
**Perlu refresh saat:**
- User mengirim pesan baru
- Menerima pesan baru dari user lain
- User masuk ke halaman obrolan (initial fetch)
- Menerima event pesan dibaca (`read` / `seen`)

**Cara refresh:**
- **WebSocket:** Tambah pesan ke state lokal saat event `chat`
- **Manual:** Fetch ulang saat buka halaman obrolan

### ✅ 3. Notifikasi (Unread Count / Badge)
**Perlu refresh saat:**
- Menerima pesan baru (status `read = false`)
- User membuka/membaca pesan (ubah jadi `read = true`)
- User login/logout (reset state notifikasi)

**Cara refresh:**
- **WebSocket:** Event `notif`
- **REST API:** `GET /notif?userId=xxx`
- **Logic:** Update `unreadCount` per user/chat

### ✅ 4. Status Pesan (Read / Delivered / Failed)
**Perlu refresh saat:**
- Penerima membaca pesan → event `read`
- Pesan gagal dikirim (e.g., koneksi terputus)
- Pesan berhasil terkirim (acknowledgment)

**Cara refresh:**
- Client mengirim `read` saat membuka obrolan
- Server broadcast event `read` ke pengirim
- UI update status:  
  - ✔️ Terkirim  
  - 👁️ Dibaca  
  - ❌ Gagal  

### ✅ 5. Status Online User
**Perlu refresh saat:**
- User connect/disconnect dari WebSocket
- Perubahan status idle/active

**Cara refresh:**
- Emit event `online` / `offline` saat connect/disconnect
- Backend maintain `onlineUsers` map
- Server broadcast update status ke semua client

### ✅ 6. Typing Indicator
**Perlu refresh saat:**
- User mulai mengetik → event `typing`
- User berhenti mengetik → event `stopTyping`

## 🧠 Rangkuman Refresh

| Komponen         | Harus Refresh Saat                     | Event/API               |
|------------------|-----------------------------------------|--------------------------|
| **Chat List**    | Pesan baru, urutan berubah             | `chat`, `notif`, REST    |
| **Chat Detail**  | Pesan masuk/keluar                     | `chat`, `read`           |
| **Unread Count** | Pesan belum dibaca                     | `notif`, REST            |
| **Read Status**  | Penerima membaca pesan                 | `read`                   |
| **Typing Status**| Lawan bicara sedang mengetik           | `typing`, `stopTyping`   |
| **Online Status**| User connect/disconnect                | `online`, `offline`      |

## 📡 Tips Pengembangan

- Gunakan **WebSocket** untuk komunikasi real-time dan update UI langsung.
- Gunakan **REST API** sebagai fallback atau untuk initial fetch data.
- Jaga **sinkronisasi state lokal** (React state, Redux, atau lainnya) dengan event WebSocket.
- Hindari **over-fetching** data — gunakan WebSocket dengan efisien dan batasi polling.
