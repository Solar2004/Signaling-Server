/**
 * Yjs WebSocket Signaling Server for Deno Deploy
 * Handles room-based message relay with password authentication
 */

const rooms = new Map<string, Set<WebSocket>>();
const SIGNALING_PASSWORD = Deno.env.get("SIGNALING_PASSWORD") || "change-me-in-production";

interface ClientInfo {
  room: string | null;
  socket: WebSocket;
  connectedAt: Date;
}

const clients = new WeakMap<WebSocket, ClientInfo>();

function log(level: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logData = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${logData}`);
}

function getTotalClients(): number {
  let total = 0;
  rooms.forEach((clients) => total += clients.size);
  return total;
}

function getRoomStats() {
  const stats: Record<string, number> = {};
  rooms.forEach((clients, room) => {
    stats[room] = clients.size;
  });
  return stats;
}

Deno.serve((req) => {
  const url = new URL(req.url);
  const upgrade = req.headers.get("upgrade");

  // Health check - but ONLY if not a WebSocket
  if (upgrade !== "websocket" && (url.pathname === "/health" || url.pathname === "/")) {
    const stats = {
      status: "ok",
      totalRooms: rooms.size,
      totalClients: getTotalClients(),
      rooms: getRoomStats(),
      uptime: performance.now() / 1000,
    };

    return new Response(JSON.stringify(stats, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if it's a WebSocket upgrade request
  if (upgrade !== "websocket") {
    return new Response("WebSocket signaling server. Connect via WebSocket.", {
      status: 426,
      headers: { "Upgrade": "websocket" }
    });
  }

  // Authentication: Check Sec-WebSocket-Protocol header
  const protocol = req.headers.get("sec-websocket-protocol");

  log("DEBUG", "WebSocket auth check", {
    provided: protocol ? (protocol.substring(0, 3) + "***") : "NONE",
    expected: SIGNALING_PASSWORD.substring(0, 3) + "***",
    match: protocol === SIGNALING_PASSWORD
  });

  if (protocol !== SIGNALING_PASSWORD) {
    log("WARN", "Authentication FAILED", {
      ip: req.headers.get("x-forwarded-for") || "unknown"
    });
    return new Response("Unauthorized: Invalid password", { status: 401 });
  }

  log("INFO", "Authentication SUCCESS");

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req, {
    protocol: SIGNALING_PASSWORD,
  });

  const clientInfo: ClientInfo = {
    room: null,
    socket,
    connectedAt: new Date(),
  };

  clients.set(socket, clientInfo);

  socket.addEventListener("open", () => {
    log("INFO", "✅ Client connected", {
      totalClients: getTotalClients() + 1,
    });
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle room subscription (y-webrtc protocol)
      if (data.type === "subscribe" && data.topics && Array.isArray(data.topics)) {
        const room = data.topics[0];

        // Remove from old room if exists
        if (clientInfo.room && rooms.has(clientInfo.room)) {
          rooms.get(clientInfo.room)!.delete(socket);
          if (rooms.get(clientInfo.room)!.size === 0) {
            rooms.delete(clientInfo.room);
          }
        }

        // Add to new room
        clientInfo.room = room;
        if (!rooms.has(room)) {
          rooms.set(room, new Set());
        }
        rooms.get(room)!.add(socket);

        log("INFO", "Client joined room", {
          room,
          roomClients: rooms.get(room)!.size,
          totalRooms: rooms.size,
        });
      }

      // Relay message to other clients in the same room
      if (clientInfo.room && rooms.has(clientInfo.room)) {
        const roomClients = rooms.get(clientInfo.room)!;
        let relayedCount = 0;

        roomClients.forEach((client) => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(event.data);
            relayedCount++;
          }
        });

        // Log relay for debugging (skip ping/pong)
        if (data.type && !["ping", "pong"].includes(data.type)) {
          log("DEBUG", "Message relayed", {
            room: clientInfo.room,
            type: data.type,
            recipients: relayedCount,
          });
        }
      }
    } catch (e) {
      // If message is not JSON, relay as-is
      if (clientInfo.room && rooms.has(clientInfo.room)) {
        rooms.get(clientInfo.room)!.forEach((client) => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(event.data);
          }
        });
      }
      log("DEBUG", "Non-JSON message relayed");
    }
  });

  socket.addEventListener("close", () => {
    if (clientInfo.room && rooms.has(clientInfo.room)) {
      rooms.get(clientInfo.room)!.delete(socket);

      const remainingInRoom = rooms.get(clientInfo.room)!.size;

      if (remainingInRoom === 0) {
        rooms.delete(clientInfo.room);
      }

      log("INFO", "Client left room", {
        room: clientInfo.room,
        remainingInRoom,
        totalRooms: rooms.size,
      });
    }

    clients.delete(socket);
  });

  socket.addEventListener("error", (e) => {
    log("ERROR", "WebSocket error", {
      error: e instanceof ErrorEvent ? e.message : "Unknown error",
    });
  });

  return response;
});

log("INFO", "🚀 Signaling server started", {
  environment: Deno.env.get("DENO_DEPLOYMENT_ID") ? "Deno Deploy" : "Local",
  passwordConfigured: SIGNALING_PASSWORD !== "change-me-in-production",
});
