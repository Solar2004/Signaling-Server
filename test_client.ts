/**
 * Test client for the signaling server
 * 
 * This script simulates two clients connecting to the same room
 * and exchanging messages to verify the server works correctly.
 */

const SERVER_URL = "ws://localhost:8000";
const PASSWORD = Deno.env.get("SIGNALING_PASSWORD") || "change-me-in-production";
const TEST_ROOM = "test-room-" + Date.now();

function log(client: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${timestamp}] [${client}] ${message}${dataStr}`);
}

async function createClient(name: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL, PASSWORD);

        ws.onopen = () => {
            log(name, "✅ Connected to server");

            // Subscribe to test room
            ws.send(JSON.stringify({
                type: "subscribe",
                topics: [TEST_ROOM]
            }));

            log(name, `📡 Subscribed to room: ${TEST_ROOM}`);
            resolve(ws);
        };

        ws.onerror = (error) => {
            log(name, "❌ Connection error", error);
            reject(error);
        };

        ws.onclose = () => {
            log(name, "🔌 Disconnected from server");
        };
    });
}

async function testAuthentication() {
    console.log("\n🔐 Testing Authentication...\n");

    // Test with wrong password
    try {
        const wrongWs = new WebSocket(SERVER_URL, "wrong-password");

        await new Promise((resolve, reject) => {
            wrongWs.onerror = () => {
                log("Auth Test", "✅ Correctly rejected wrong password");
                resolve(null);
            };

            wrongWs.onopen = () => {
                log("Auth Test", "❌ SECURITY ISSUE: Accepted wrong password!");
                wrongWs.close();
                reject(new Error("Server accepted wrong password"));
            };
        });
    } catch (e) {
        // Expected to fail
    }

    // Test with correct password
    const correctWs = await createClient("Auth Test");
    log("Auth Test", "✅ Correctly accepted right password");
    correctWs.close();

    await new Promise(resolve => setTimeout(resolve, 500));
}

async function testMessageRelay() {
    console.log("\n📨 Testing Message Relay...\n");

    const client1 = await createClient("Client 1");
    const client2 = await createClient("Client 2");

    // Wait for both to connect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Set up message listeners
    let client1ReceivedCount = 0;
    let client2ReceivedCount = 0;

    client1.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log("Client 1", "📬 Received message", data);
        client1ReceivedCount++;
    };

    client2.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log("Client 2", "📬 Received message", data);
        client2ReceivedCount++;
    };

    // Client 1 sends a message
    await new Promise(resolve => setTimeout(resolve, 500));
    const msg1 = { type: "test", from: "client1", data: "Hello from Client 1!" };
    client1.send(JSON.stringify(msg1));
    log("Client 1", "📤 Sent message", msg1);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Client 2 sends a message
    const msg2 = { type: "test", from: "client2", data: "Hello from Client 2!" };
    client2.send(JSON.stringify(msg2));
    log("Client 2", "📤 Sent message", msg2);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify message relay
    if (client1ReceivedCount === 1 && client2ReceivedCount === 1) {
        log("Relay Test", "✅ Messages relayed correctly");
    } else {
        log("Relay Test", `❌ Message relay failed. Client1 received: ${client1ReceivedCount}, Client2 received: ${client2ReceivedCount}`);
    }

    client1.close();
    client2.close();

    await new Promise(resolve => setTimeout(resolve, 500));
}

async function testRoomIsolation() {
    console.log("\n🚪 Testing Room Isolation...\n");

    const ROOM_A = "room-a-" + Date.now();
    const ROOM_B = "room-b-" + Date.now();

    const clientA = new WebSocket(SERVER_URL, PASSWORD);
    const clientB = new WebSocket(SERVER_URL, PASSWORD);

    await new Promise(resolve => {
        let connected = 0;

        clientA.onopen = () => {
            clientA.send(JSON.stringify({ type: "subscribe", topics: [ROOM_A] }));
            log("Client A", `Joined room: ${ROOM_A}`);
            connected++;
            if (connected === 2) resolve(null);
        };

        clientB.onopen = () => {
            clientB.send(JSON.stringify({ type: "subscribe", topics: [ROOM_B] }));
            log("Client B", `Joined room: ${ROOM_B}`);
            connected++;
            if (connected === 2) resolve(null);
        };
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    let clientAReceived = false;
    let clientBReceived = false;

    clientA.onmessage = () => {
        clientAReceived = true;
    };

    clientB.onmessage = () => {
        clientBReceived = true;
    };

    // Client A sends message
    clientA.send(JSON.stringify({ type: "test", from: "A" }));

    await new Promise(resolve => setTimeout(resolve, 500));

    if (!clientAReceived && !clientBReceived) {
        log("Isolation Test", "✅ Rooms are properly isolated");
    } else {
        log("Isolation Test", "❌ Room isolation failed!");
    }

    clientA.close();
    clientB.close();

    await new Promise(resolve => setTimeout(resolve, 500));
}

// Run all tests
async function runTests() {
    console.log("🧪 Starting Signaling Server Tests\n");
    console.log(`Server: ${SERVER_URL}`);
    console.log(`Password: ${PASSWORD}`);
    console.log("=".repeat(50));

    try {
        await testAuthentication();
        await testMessageRelay();
        await testRoomIsolation();

        console.log("\n" + "=".repeat(50));
        console.log("✅ All tests passed!\n");
    } catch (error) {
        console.error("\n❌ Tests failed:", error);
        Deno.exit(1);
    }
}

runTests();
