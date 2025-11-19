# WebRTC Signaling Server

A secure, multi-room WebRTC signaling server built with Deno. Perfect for collaborative applications using libraries like `y-webrtc`, `simple-peer`, or any WebRTC-based project.

## 🔒 Security Features

- **Header-based Authentication**: Uses `Sec-WebSocket-Protocol` to prevent password leakage in URLs
- **Multi-room Isolation**: Clients are automatically isolated by room names
- **TLS Encryption**: All traffic over `wss://` is encrypted in transit

> [!IMPORTANT]
> **For global connectivity (users in different locations/VPNs):** This signaling server **only coordinates WebRTC connections**. For actual peer-to-peer connectivity across NAT/firewalls, you need **STUN/TURN servers**. See [STUN_TURN_GUIDE.md](./STUN_TURN_GUIDE.md) for detailed setup instructions.

## 🚀 Quick Start

### Local Development

1. **Install Deno** (if not already installed):
```bash
curl -fsSL https://deno.land/install.sh | sh
```

2. **Set your password** (optional, defaults to "change-me-in-production"):
```bash
export SIGNALING_PASSWORD="your-secure-password"
```

3. **Run the server**:
```bash
deno task start
```

Or with hot-reload during development:
```bash
deno task dev
```

The server will start on `http://localhost:8000`.

### Deploy to Deno Deploy

1. **Install Deno CLI** (if not already installed):
```bash
curl -fsSL https://deno.land/install.sh | sh
```

2. **Login to Deno Deploy**:
```bash
deno deploy
```

3. **Deploy the project**:
```bash
deno deploy --project=my-signaling-server main.ts
```

4. **Set the password** in Deno Deploy dashboard:
   - Go to your project settings
   - Add environment variable: `SIGNALING_PASSWORD` = `your-secure-password`

You'll get a URL like: `wss://my-signaling-server.deno.dev`

## 💻 Client Usage

### With y-webrtc

```javascript
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

const ydoc = new Y.Doc();

const provider = new WebrtcProvider(
  'my-room-name', // Room name (can be any string)
  ydoc,
  {
    signaling: ['wss://my-signaling-server.deno.dev'],
    password: 'your-secure-password', // ✅ Password in config, not URL
    
    // ⚠️ REQUIRED for global connectivity (users in different locations)
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      }
    }
  }
);
```

> [!TIP]
> For users behind strict firewalls or using VPNs, you'll also need TURN servers. See [STUN_TURN_GUIDE.md](./STUN_TURN_GUIDE.md) for complete setup.

### With vanilla WebSocket

```javascript
// The second parameter becomes the Sec-WebSocket-Protocol header
const ws = new WebSocket('wss://my-signaling-server.deno.dev', 'your-secure-password');

ws.onopen = () => {
  console.log('Connected!');
  
  // Subscribe to a room (y-webrtc protocol)
  ws.send(JSON.stringify({
    type: 'subscribe',
    topics: ['my-room-name']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Multiple Projects on One Server

Each project uses a different room name:

```javascript
// Project 1: Collaborative Spreadsheet
const provider1 = new WebrtcProvider('lumina-sheets-v1', ydoc, {
  signaling: ['wss://my-signaling-server.deno.dev'],
  password: 'your-secure-password',
});

// Project 2: Text Editor
const provider2 = new WebrtcProvider('editor-docs', ydoc, {
  signaling: ['wss://my-signaling-server.deno.dev'],
  password: 'your-secure-password',
});

// Project 3: Whiteboard
const provider3 = new WebrtcProvider('whiteboard-collab', ydoc, {
  signaling: ['wss://my-signaling-server.deno.dev'],
  password: 'your-secure-password',
});
```

## 📊 Monitoring

### Health Check

Visit `https://your-server.deno.dev/health` to see server status:

```json
{
  "status": "ok",
  "totalRooms": 3,
  "totalClients": 8,
  "rooms": {
    "lumina-sheets-v1": 3,
    "editor-docs": 2,
    "whiteboard-collab": 3
  },
  "uptime": 12345.67
}
```

### Server Logs

The server logs all important events:
- Client connections/disconnections
- Room joins/leaves
- Authentication failures
- Message relay statistics

## 🧪 Testing

### Quick Test (Browser-based, STUN+TURN included)

The easiest way to verify global connectivity:

1. **Open the test client**:
   ```bash
   # Serve the test client locally
   deno task test-client
   ```
   Or simply open `test_client.html` in your browser.

2. **Configure and connect**:
   - Enter your signaling server URL
   - Enter your password
   - Share the Room ID with a friend
   - Click "🚀 Conectar"

3. **Verify**:
   - You should see "✅ Conectado y Sincronizado"
   - When your friend connects, you'll see "👤 Peer conectado"

> [!TIP]
> This test client includes free TURN servers from Metered.ca, so it works even behind strict firewalls/VPNs!

### Command-line Test

Run the automated test suite to verify the server works:

```bash
deno task test
```

This will simulate two clients connecting to the same room and exchanging messages.

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SIGNALING_PASSWORD` | `change-me-in-production` | Password required to connect |

### Port

The server runs on port `8000` by default. To change it, modify the `Deno.serve()` call in `main.ts`:

```typescript
Deno.serve({ port: 3000 }, (req) => {
  // ...
});
```

## 📝 How It Works

1. **Client connects** with password in `Sec-WebSocket-Protocol` header
2. **Server validates** password and upgrades to WebSocket
3. **Client subscribes** to a room by sending `{ type: 'subscribe', topics: ['room-name'] }`
4. **Server relays** all messages from one client to all other clients in the same room
5. **WebRTC handshake** happens between peers (server only relays signaling)
6. **P2P connection** established - actual data flows directly between peers

## 🎯 Why This Architecture?

- **One server, unlimited projects**: Room-based isolation means no configuration per project
- **Secure**: Password is never in the URL, preventing leakage in logs/browser history
- **Free hosting**: Deno Deploy offers generous free tier (100k requests/day)
- **Zero config**: No database, no state management - just message relay
- **Automatic cleanup**: Empty rooms are deleted automatically

## 🐛 Troubleshooting

### "Cannot connect from different locations/VPNs"

**This is NOT a signaling server issue!** WebRTC needs STUN/TURN servers for NAT traversal. The signaling server only coordinates connections - it doesn't establish them.

👉 **Solution**: Configure STUN/TURN servers in your WebRTC client. See [STUN_TURN_GUIDE.md](./STUN_TURN_GUIDE.md)

### "Uptime resets"

The uptime counter now uses wall-clock time (`Date.now()`) instead of `performance.now()`, so it persists across Deno Deploy cold starts. However, if Deno Deploy fully restarts your deployment (new instance), the uptime will reset - this is expected behavior.

### TypeScript errors in IDE

If you see "Cannot find name 'Deno'" errors, your IDE needs Deno configuration:

**VS Code**: Install the [Deno extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) and enable it in your workspace.

### Connection rejected (401)

Check that your client is passing the correct password via the `Sec-WebSocket-Protocol` header:

```javascript
// Correct
new WebSocket('wss://server.deno.dev', 'your-password');

// Wrong - password in URL won't work
new WebSocket('wss://server.deno.dev?password=wrong');
```

## 📄 License

MIT - Feel free to use in your projects!
