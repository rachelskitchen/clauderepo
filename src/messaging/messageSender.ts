export interface OutboundMessage {
  channel: "EMAIL" | "SMS";
  to: string;
  subject?: string;
  body: string;
}

export interface MessageSender {
  send(message: OutboundMessage): Promise<void>;
}
