# 🔧 Troubleshooting de Conectividad Global

## 📋 Checklist de Diagnóstico

### ✅ Paso 1: Verificar el Servidor de Señalización

1. **Accede al endpoint de salud:**
   ```bash
   curl https://your-server.deno.dev/health
   ```
   
   Deberías ver:
   ```json
   {
     "status": "ok",
     "totalRooms": 0,
     "totalClients": 0,
     "rooms": {},
     "uptime": 123.45
   }
   ```

2. **Si el servidor está caído:**
   - Verifica en Deno Deploy dashboard
   - Revisa los logs del servidor
   - Redeploy si es necesario: `deno deploy --project=your-project main.ts`

### ✅ Paso 2: Verificar Configuración del Cliente

#### Opción A: Usa el Test Client HTML (MÁS FÁCIL)

1. Abre `test_client.html` en tu navegador
2. Configura:
   - Servidor: `wss://your-server.deno.dev`
   - Password: (tu password)
   - Room ID: (compártelo con tu amigo)
3. Click "Conectar"
4. Pide a tu amigo que haga lo mismo

**Este cliente INCLUYE TURN automáticamente**, así que debería funcionar incluso con VPN/firewalls.

#### Opción B: Verifica tu Código

Si estás usando tu propia aplicación, verifica que incluyas esto:

```javascript
const provider = new WebrtcProvider('room-name', ydoc, {
  signaling: ['wss://your-server.deno.dev'],
  password: 'your-password',
  
  // ⚠️ ESTO ES CRÍTICO ⚠️
  peerOpts: {
    config: {
      iceServers: [
        // STUN (obligatorio para diferentes IPs)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // TURN (necesario para VPN/firewalls estrictos)
        {
          urls: 'turn:a.relay.metered.ca:80',
          username: 'e80088571ff421259f93b98c',
          credential: 'TpHFBALEcpIyjJKs',
        }
      ]
    }
  }
});
```

### ✅ Paso 3: Debugging en el Navegador

1. **Abre Chrome DevTools** (F12)
2. **Pestaña Console** - busca errores
3. **Pestaña Network → WS** - verifica la conexión WebSocket al servidor de señalización
4. **chrome://webrtc-internals/** - ver detalles de ICE candidates

#### Qué buscar:

**✅ BUENO:**
```
📡 Estado de conexión: connected
✅ ¡Sincronizado con éxito!
👤 Peer conectado: [peer-id]
```

**❌ MALO:**
```
❌ WebSocket connection failed
❌ ICE connection failed
❌ No ICE candidates found
```

### ✅ Paso 4: Problemas Comunes y Soluciones

| Síntoma | Causa Probable | Solución |
|---------|----------------|----------|
| "WebSocket 401" | Password incorrecto | Verifica que el password coincida con el del servidor |
| "WebSocket 1006" | Servidor caído o URL incorrecta | Verifica el endpoint `/health` |
| "Conecta pero no ve peers" | Diferentes Room IDs | Ambos deben usar exactamente el mismo Room ID |
| "Conecta localmente pero no globalmente" | Falta STUN/TURN | Agrega configuración ICE (ver arriba) |
| "Funciona sin VPN, falla con VPN" | Necesita TURN | Agrega servidor TURN a ICE servers |
| "Muy lento para conectar" | Solo usando STUN, necesita TURN | Agrega TURN para conexiones más rápidas con firewall |

### ✅ Paso 5: Test de STUN/TURN

#### Test de STUN (online):

Ve a: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Configuración:
```
STUN URI: stun:stun.l.google.com:19302
```

Haz click en "Gather candidates". Deberías ver:
- `host` candidates (tu IP local)
- `srflx` candidates (tu IP pública) ← **ESTO ES LO IMPORTANTE**

Si NO ves `srflx` candidates, hay un problema de red.

#### Test de TURN (online):

En la misma página, agrega:
```
TURN URI: turn:a.relay.metered.ca:80
Username: e80088571ff421259f93b98c
Password: TpHFBALEcpIyjJKs
```

Deberías ver `relay` candidates.

### ✅ Paso 6: Verificación con Logs del Servidor

Si tienes acceso a los logs del servidor de señalización (Deno Deploy dashboard):

**✅ BUENO:**
```
[INFO] ✅ Client connected
[INFO] Client joined room { room: "test-room", roomClients: 2 }
[DEBUG] Message relayed { room: "test-room", type: "offer", recipients: 1 }
```

**❌ MALO:**
```
[WARN] Authentication FAILED
```
→ El cliente no está enviando el password correcto

## 🆘 Si Nada Funciona

### Último Recurso: Test Client con TODO Incluido

1. Descarga el repositorio:
   ```bash
   git clone https://github.com/Solar2004/Signaling-Server.git
   cd Signaling-Server
   ```

2. Sirve el test client:
   ```bash
   deno task test-client
   ```

3. Abre en tu navegador: `http://localhost:8080/test_client.html`

4. Pide a tu amigo que haga lo mismo

5. **Ambos deben:**
   - Usar el MISMO servidor de señalización
   - Usar el MISMO password
   - Usar el MISMO Room ID
   - Ver "✅ Conectado y Sincronizado"

Si esto NO funciona, el problema es:
- Red corporativa bloqueando WebRTC completamente
- ISP bloqueando puertos
- Software antivirus/firewall local

### Solución Nuclear: Usar TURN Relay Forzado

Si absolutamente nada funciona, fuerza relay mode (todo el tráfico pasa por TURN):

```javascript
peerOpts: {
  config: {
    iceServers: [
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'e80088571ff421259f93b98c',
        credential: 'TpHFBALEcpIyjJKs',
      }
    ],
    iceTransportPolicy: 'relay' // ← FUERZA relay
  }
}
```

**Advertencia:** Esto usa más ancho de banda del servidor TURN.

## 📞 Obtener Ayuda

Si después de seguir esta guía completa aún no funciona:

1. **Recopila esta información:**
   - URL del servidor de señalización
   - Respuesta del endpoint `/health`
   - Screenshot de la consola del navegador
   - Screenshot de `chrome://webrtc-internals/`
   - ¿Están usando VPN? ¿Qué tipo de red (casa, corporativa)?

2. **Crea un Issue en GitHub:**
   https://github.com/Solar2004/Signaling-Server/issues

3. **Incluye los resultados del test client HTML**

## 🎓 Entender WebRTC

Para entender mejor cómo funciona:

```
┌─────────┐                                    ┌─────────┐
│Client A │                                    │Client B │
└────┬────┘                                    └────┬────┘
     │                                              │
     │  1. WebSocket (Signaling Messages)          │
     ├──────────────► Servidor de ◄────────────────┤
     │                Señalización                  │
     │                                              │
     │  2. ICE Candidates Exchange                 │
     ├─────────────────────────────────────────────┤
     │                                              │
     │  3. STUN: Descubrir IP Pública              │
     ├──────────► STUN Server ◄────────────────────┤
     │              (Google)                        │
     │                                              │
     │  4. Intentar Conexión Directa (P2P)         │
     ├─────────────────────────────────────────────┤
     │            ✅ SI FUNCIONA: Listo!            │
     │                                              │
     │  5. Si P2P Falla: Usar TURN                 │
     ├──────────► TURN Server ◄────────────────────┤
     │            (Metered.ca)                      │
     │                                              │
     └─────────────────────────────────────────────┘
        Conexión establecida (directa o relay)
```

**Importante:**
- El **servidor de señalización** solo pasa mensajes (steps 1-2)
- **STUN** ayuda a encontrar tu IP pública (step 3)
- **TURN** retransmite si la conexión directa falla (step 5)
- La **conexión real de datos** es P2P cuando es posible

## ✅ Criterios de Éxito

Tu configuración está funcionando correctamente cuando:

- [ ] El endpoint `/health` responde
- [ ] El test client se conecta ("✅ Conectado y Sincronizado")
- [ ] Ves peers cuando alguien más se conecta
- [ ] Los mensajes se envían entre peers
- [ ] Funciona con personas en diferentes ubicaciones geográficas
- [ ] Funciona con VPN activada
- [ ] Funciona en diferentes redes (casa, móvil, etc.)

Si todos estos puntos se cumplen: **¡Felicitaciones! 🎉 Tu servidor está funcionando perfectamente.**
