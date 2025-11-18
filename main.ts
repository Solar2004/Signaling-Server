/**
 * Deno WebRTC Signaling Server
 * 
 * A secure, multi-room signaling server for WebRTC applications.
 * Uses Sec-WebSocket-Protocol header for authentication to prevent password leakage.
 */

// Store rooms and their connected clients
const rooms = new Map<string, Set<WebSocket>>();

// Get password from environment variable
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

// Port configuration (Deno Deploy ignores this, uses automatic assignment)
const port = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port }, (req) => {
  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname === "/health" || url.pathname === "/") {
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
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("WebSocket signaling server. Connect via WebSocket.", {
      status: 426,
      headers: { "Upgrade": "websocket" }
    });
  }

  // DEBUG: Log all incoming WebSocket upgrade requests
  log("DEBUG", "WebSocket upgrade request received", {
    url: req.url,
    upgrade: req.headers.get("upgrade"),
    connection: req.headers.get("connection"),
    origin: req.headers.get("origin"),
    userAgent: req.headers.get("user-agent")?.substring(0, 50)
  });

  // Authentication: Check Sec-WebSocket-Protocol header
  const protocol = req.headers.get("sec-websocket-protocol");

  // DEBUG: Log authentication details
  log("DEBUG", "Authentication check", {
    providedProtocol: protocol || "NONE",
    expectedPassword: SIGNALING_PASSWORD.substring(0, 3) + "***" + SIGNALING_PASSWORD.substring(SIGNALING_PASSWORD.length - 3),
    passwordLength: SIGNALING_PASSWORD.length,
    match: protocol === SIGNALING_PASSWORD
  });

  if (protocol !== SIGNALING_PASSWORD) {
    log("WARN", "Authentication FAILED", {
      providedProtocol: protocol || "NONE",
      providedLength: protocol?.length || 0,
      expectedPrefix: SIGNALING_PASSWORD.substring(0, 5) + "***",
      expectedLength: SIGNALING_PASSWORD.length,
      ip: req.headers.get("x-forwarded-for") || "unknown",
      origin: req.headers.get("origin")
    });
    return new Response("Unauthorized: Invalid password", { status: 401 });
  }

  log("INFO", "Authentication SUCCESS - Upgrading to WebSocket", {
    protocol: protocol.substring(0, 3) + "***"
  });

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req, {
    protocol: SIGNALING_PASSWORD, // Echo back the protocol for successful auth
  });

  const clientInfo: ClientInfo = {
    room: null,
    socket,
    connectedAt: new Date(),
  };

  clients.set(socket, clientInfo);

  socket.addEventListener("open", () => {
    log("INFO", "Client connected", {
      totalClients: getTotalClients() + 1,
    });
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      // Detect room subscription (y-webrtc protocol)
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
          totalClients: getTotalClients(),
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

        // Log relay for debugging (only for important message types)
        if (data.type && ["ping", "pong"].includes(data.type) === false) {
          log("DEBUG", "Message relayed", {
            room: clientInfo.room,
            type: data.type,
            recipientCount: relayedCount,
          });
        }
      }
    } catch (e) {
      // If message is not JSON, relay as-is to all clients in room (fallback)
      if (clientInfo.room && rooms.has(clientInfo.room)) {
        rooms.get(clientInfo.room)!.forEach((client) => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(event.data);
          }
        });
      }
      log("DEBUG", "Non-JSON message relayed", { error: (e as Error).message });
    }
  });

  socket.addEventListener("close", () => {
    if (clientInfo.room && rooms.has(clientInfo.room)) {
      rooms.get(clientInfo.room)!.delete(socket);

      const remainingInRoom = rooms.get(clientInfo.room)!.size;

      // Clean up empty room
      if (remainingInRoom === 0) {
        rooms.delete(clientInfo.room);
      }

      log("INFO", "Client left room", {
        room: clientInfo.room,
        remainingInRoom,
        totalRooms: rooms.size,
        totalClients: getTotalClients(),
      });
    } else {
      log("INFO", "Client disconnected before joining room");
    }

    clients.delete(socket);
  });

  socket.addEventListener("error", (e) => {
    log("ERROR", "WebSocket error", {
      error: e instanceof ErrorEvent ? e.message : "Unknown error",
      room: clientInfo.room
    });
  });

  return response;
});

log("INFO", "🚀 Signaling server started", {
  port,
  environment: Deno.env.get("DENO_DEPLOYMENT_ID") ? "Deno Deploy" : "Local",
  passwordConfigured: SIGNALING_PASSWORD !== "change-me-in-production",
});
