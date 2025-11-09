import * as amqp from 'amqplib';
import { MessagePublisher } from './types/messagePublisher.interface';
import { MessageSubscriber } from './types/messageSubscriber.interface';

export class RabbitMQService implements MessagePublisher, MessageSubscriber {
	private connection: amqp.ChannelModel;
	private channel: amqp.Channel;

	constructor(private url: string, private exchangeName: string) {}

	async connect(): Promise<void> {
		this.connection = await amqp.connect(this.url);
		this.channel = await this.connection.createChannel();
		await this.channel.assertExchange(this.exchangeName, 'fanout', { durable: true });
	}

	async publish(message: string): Promise<void> {
		if (!this.channel) throw new Error('Channel not initialized');
		this.channel.publish(this.exchangeName, '', Buffer.from(JSON.stringify(message)));
		console.log(`Published message to exchange ${this.exchangeName}: ${message}`);
	}

	async subscribe(handler: (message: string) => void): Promise<void> {
		if (!this.channel) throw new Error('Channel not initialized');

		const queue = await this.channel.assertQueue('', { exclusive: true });
		await this.channel.bindQueue(queue.queue, this.exchangeName, '');

		this.channel.consume(queue.queue, (message) => {
			if (!message) return;

			try {
				const data = JSON.parse(message.content.toString());
				handler(data);
				this.channel?.ack(message);
			} catch (error) {
				console.error('Error processing message:', error);
				this.channel.nack(message, false, true);
			}
		});
	}
}
