import pako from 'pako';

/**
 * StreamManager [Shadow Operator]
 * Connects to BingX WebSockets for real-time market data.
 * Handles GZIP decompression, heartbeat, exponential backoff, and page lifecycle.
 */
export class StreamManager {
  private ws: WebSocket | null = null;
  private url = 'wss://open-api-ws.bingx.com/market';
  private subscriptions: string[] = [];
  private onMessageCallback: (data: any) => void;
  public onStatusChange: (status: 'STABLE' | 'DISCONNECTED') => void = () => { };

  // Exponential backoff state
  private reconnectAttempt = 0;
  private readonly BASE_DELAY = 1000;
  private readonly MAX_DELAY = 60000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(onMessage: (data: any) => void) {
    this.onMessageCallback = onMessage;

    // Lifecycle listeners — disconnect when page is hidden/closed
    window.addEventListener('pagehide', () => this.disconnect());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.disconnect();
      } else if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connect();
      }
    });
  }

  connect() {
    // Annuler un éventuel reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    console.log("[Shadow Operator] Establishing WebSocket link to the Grid...");
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log("[Shadow Operator] WSS Link: SECURE. Synchronizing streams...");
      this.reconnectAttempt = 0; // Reset backoff on success
      this.onStatusChange('STABLE');
      this.resubscribe();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      console.warn("[Shadow Operator] WSS Link severed. Initiating auto-reconnect...");
      this.onStatusChange('DISCONNECTED');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[Shadow Operator] WSS Signal Interference:", error);
    };
  }

  /**
   * Exponential backoff with jitter.
   * Délais : 1s, 2s, 4s, 8s, 16s, 32s, 60s max.
   */
  private scheduleReconnect() {
    const delay = Math.min(
      this.BASE_DELAY * Math.pow(2, this.reconnectAttempt) + Math.random() * 1000,
      this.MAX_DELAY
    );
    this.reconnectAttempt++;
    console.log(`[Shadow Operator] Reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  subscribe(dataType: string) {
    if (!this.subscriptions.includes(dataType)) {
      this.subscriptions.push(dataType);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subMsg = JSON.stringify({
        id: crypto.randomUUID(),
        reqType: "sub",
        dataType: dataType
      });
      this.ws.send(subMsg);
      console.log(`[Shadow Operator] Subscribed to ${dataType}`);
    }
  }

  private resubscribe() {
    this.subscriptions.forEach(sub => this.subscribe(sub));
  }

  private handleMessage(data: ArrayBuffer) {
    try {
      // Decompress GZIP
      const decompressed = pako.inflate(new Uint8Array(data), { to: 'string' });

      // Heartbeat Check
      if (decompressed === 'Ping') {
        this.ws?.send('Pong');
        return;
      }

      const json = JSON.parse(decompressed);
      if (json.data) {
        this.onMessageCallback(json);
      }
    } catch (e) {
      console.error("[Shadow Operator] Malformed data packet:", e);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
  }
}
