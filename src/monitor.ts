import WebSocket from "ws";
import { EventEmitter } from "events";
import { BerryPayWallet } from "./wallet.js";

export interface ConfirmationMessage {
  topic: string;
  time: string;
  message: {
    account: string;
    amount: string;
    hash: string;
    confirmation_type: string;
    block: {
      type: string;
      account: string;
      previous: string;
      representative: string;
      balance: string;
      link: string;
      link_as_account: string;
      signature: string;
      work: string;
      subtype: string;
    };
  };
}

export interface PaymentEvent {
  hash: string;
  from: string;
  to: string;
  amount: string;
  amountNano: string;
  timestamp: Date;
}

export interface MonitorConfig {
  wsUrl?: string;
  accounts?: string[];
}

const DEFAULT_WS_URL = "wss://uk1.public.xnopay.com/ws";

export class BlockLatticeMonitor extends EventEmitter {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private accounts: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isRunning = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: MonitorConfig = {}) {
    super();
    this.wsUrl = config.wsUrl ?? DEFAULT_WS_URL;
    if (config.accounts) {
      config.accounts.forEach((a) => this.accounts.add(a));
    }
  }

  addAccount(account: string): void {
    this.accounts.add(account);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscribe([account]);
    }
  }

  removeAccount(account: string): void {
    this.accounts.delete(account);
    // Note: Most Nano WS APIs don't support unsubscribing individual accounts
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.connect();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on("open", () => {
          this.reconnectAttempts = 0;
          this.emit("connected");

          // Subscribe to all tracked accounts
          if (this.accounts.size > 0) {
            this.subscribe(Array.from(this.accounts));
          }

          // Setup ping to keep connection alive
          this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.ping();
            }
          }, 30000);

          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.emit("error", new Error(`Failed to parse message: ${error}`));
          }
        });

        this.ws.on("close", () => {
          this.emit("disconnected");
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
          if (this.isRunning) {
            this.attemptReconnect();
          }
        });

        this.ws.on("error", (error) => {
          this.emit("error", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private subscribe(accounts: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Subscribe to confirmations for these accounts
    const subscribeMessage = {
      action: "subscribe",
      topic: "confirmation",
      options: {
        accounts,
      },
    };

    this.ws.send(JSON.stringify(subscribeMessage));
  }

  private handleMessage(message: ConfirmationMessage): void {
    if (message.topic !== "confirmation") return;

    const block = message.message.block;
    const account = message.message.account;

    // Check if this is a send to one of our tracked accounts
    if (block.subtype === "send") {
      const toAccount = block.link_as_account;

      if (this.accounts.has(toAccount)) {
        const payment: PaymentEvent = {
          hash: message.message.hash,
          from: account,
          to: toAccount,
          amount: message.message.amount,
          amountNano: BerryPayWallet.rawToNano(message.message.amount),
          timestamp: new Date(parseInt(message.time)),
        };

        this.emit("payment", payment);
      }
    }

    // Also emit receive confirmations for our accounts
    if (block.subtype === "receive" && this.accounts.has(account)) {
      this.emit("received", {
        hash: message.message.hash,
        account,
        amount: message.message.amount,
        amountNano: BerryPayWallet.rawToNano(message.message.amount),
        timestamp: new Date(parseInt(message.time)),
      });
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("error", new Error("Max reconnect attempts reached"));
      this.isRunning = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emit("reconnecting", { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      if (this.isRunning) {
        this.connect().catch((error) => {
          this.emit("error", error);
        });
      }
    }, delay);
  }

  onPayment(callback: (payment: PaymentEvent) => void): void {
    this.on("payment", callback);
  }

  onReceived(callback: (data: { hash: string; account: string; amount: string; amountNano: string; timestamp: Date }) => void): void {
    this.on("received", callback);
  }
}

export function createMonitor(config?: MonitorConfig): BlockLatticeMonitor {
  return new BlockLatticeMonitor(config);
}
