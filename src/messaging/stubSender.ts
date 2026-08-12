import type { MessageSender, OutboundMessage } from "./messageSender.js";

/**
 * Default sender for dev/test: logs instead of hitting a real
 * email/SMS provider. Swap for SendGrid/Twilio-backed implementations
 * of MessageSender once those credentials are available.
 */
export class StubMessageSender implements MessageSender {
  public readonly sent: OutboundMessage[] = [];

  async send(message: OutboundMessage): Promise<void> {
    this.sent.push(message);
    console.log(`[stub-sender] ${message.channel} -> ${message.to}: ${message.body}`);
  }
}
