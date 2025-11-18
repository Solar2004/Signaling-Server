# Deployment Guide

## 🚀 Deploy to Deno Deploy (Recommended)

Deno Deploy is a serverless platform that makes deployment incredibly easy and offers a generous free tier.

### Method 1: GitHub Integration (Easiest)

1. **Push your code to GitHub**:
```bash
cd c:/Users/the_l/Documents/Github/Signaling-Server
git init
git add .
git commit -m "Initial commit: WebRTC signaling server"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Signaling-Server.git
git push -u origin main
```

2. **Go to Deno Deploy**:
   - Visit https://dash.deno.com/new
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Authorize Deno Deploy to access your repository
   - Select your `Signaling-Server` repository
   - Set the entry file to `main.ts`
   - Click "Deploy"

3. **Configure Environment Variables**:
   - In your Deno Deploy project dashboard
   - Go to "Settings" → "Environment Variables"
   - Add: `SIGNALING_PASSWORD` with your secure password
   - Click "Save"
   - The deployment will automatically restart with the new password

4. **Get Your URL**:
   - You'll receive a URL like: `https://your-project-name.deno.dev`
   - For WebSocket connections, use: `wss://your-project-name.deno.dev`

### Method 2: CLI Deployment

1. **Install Deno** (if not already installed):

**Windows (PowerShell)**:
```powershell
irm https://deno.land/install.ps1 | iex
```

**macOS/Linux**:
```bash
curl -fsSL https://deno.land/install.sh | sh
```

2. **Login to Deno Deploy**:
```bash
deno install -A --global jsr:@deno/deployctl
deployctl login
```

3. **Deploy**:
```bash
cd c:/Users/the_l/Documents/Github/Signaling-Server
deployctl deploy --project=my-signaling-server main.ts
```

4. **Set Environment Variables** (via CLI):
```bash
# This requires setting up the Deno Deploy dashboard
# Go to https://dash.deno.com/projects/my-signaling-server/settings
# And add SIGNALING_PASSWORD in the Environment Variables section
```

---

## 🖥️ Self-Hosting Options

### Option 1: VPS/Cloud Server

Deploy to any VPS (DigitalOcean, AWS, Hetzner, etc.):

1. **SSH into your server**:
```bash
ssh user@your-server.com
```

2. **Install Deno**:
```bash
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="/home/$USER/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

3. **Clone and configure**:
```bash
git clone https://github.com/YOUR_USERNAME/Signaling-Server.git
cd Signaling-Server
cp .env.example .env
nano .env  # Edit and set your SIGNALING_PASSWORD
```

4. **Run with systemd** (keeps it running):

Create `/etc/systemd/system/signaling-server.service`:
```ini
[Unit]
Description=WebRTC Signaling Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/home/your-user/Signaling-Server
EnvironmentFile=/home/your-user/Signaling-Server/.env
ExecStart=/home/your-user/.deno/bin/deno run --allow-net --allow-env main.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable signaling-server
sudo systemctl start signaling-server
sudo systemctl status signaling-server
```

5. **Set up reverse proxy** (nginx):

```nginx
server {
    listen 443 ssl http2;
    server_name signaling.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Option 2: Docker

Create a `Dockerfile`:
```dockerfile
FROM denoland/deno:latest

WORKDIR /app

COPY . .

ENV PORT=8000
ENV SIGNALING_PASSWORD=change-me-in-production

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "main.ts"]
```

Build and run:
```bash
docker build -t signaling-server .
docker run -d -p 8000:8000 -e SIGNALING_PASSWORD=your-password signaling-server
```

---

## 🔐 Security Best Practices

1. **Always set a strong password**:
```bash
# Generate a secure password (Linux/Mac):
openssl rand -base64 32

# Or use a password manager
```

2. **Use HTTPS/WSS in production** - All major platforms (Deno Deploy, Cloudflare, etc.) provide this automatically

3. **Keep your password secret**:
   - Never commit `.env` files to git (already in `.gitignore`)
   - Use environment variables in production
   - Rotate passwords periodically

4. **Monitor your server**:
   - Check `/health` endpoint regularly
   - Set up alerts for unusual traffic
   - Review logs for auth failures

---

## 📊 Monitoring

### Health Check

**URL**: `https://your-server.deno.dev/health`

**Response**:
```json
{
  "status": "ok",
  "totalRooms": 3,
  "totalClients": 8,
  "rooms": {
    "project-a": 3,
    "project-b": 5
  },
  "uptime": 123456.78
}
```

### Logs

On Deno Deploy:
- Go to your project dashboard
- Click "Logs" tab
- View real-time connection logs

---

## 🎯 Which Option Should I Choose?

| Platform | Best For | Cost | Difficulty |
|----------|----------|------|------------|
| **Deno Deploy** | Most users, quick setup | Free (100k req/day) | ⭐ Easy |
| **VPS** | Full control, custom domain | $5-20/month | ⭐⭐⭐ Medium |
| **Docker** | Existing infrastructure | Variable | ⭐⭐⭐ Medium |

**Recommendation**: Start with Deno Deploy. It's free, fast, and handles SSL/scaling automatically.

---

## ❓ Troubleshooting

### "Authentication failed" in logs
- Check that `SIGNALING_PASSWORD` is set in your environment
- Verify clients are sending the password in `Sec-WebSocket-Protocol` header

### Clients can't connect
- Ensure you're using `wss://` (not `ws://`) in production
- Check firewall rules if self-hosting
- Verify the server is running: `curl https://your-server.deno.dev/health`

### High latency
- Check server location (choose region close to your users)
- Consider deploying multiple servers in different regions
- Review Deno Deploy's edge locations

---

Need help? Open an issue on GitHub!
