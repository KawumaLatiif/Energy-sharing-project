import { io, Socket } from "socket.io-client";

let _socket: Socket | null = null;

export function getAdminSocket(): Socket {
  if (!_socket) {
    _socket = io("/", {
      path: "/socket.io/",
      auth: { token: localStorage.getItem("gpawa_admin_token") },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return _socket;
}

export function connectAdminSocket(): Socket {
  const s = getAdminSocket();
  if (!s.connected) s.connect();
  s.emit("join_room", { room: "admin" });
  return s;
}

export function disconnectAdminSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
