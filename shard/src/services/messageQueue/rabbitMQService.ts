import * as amqp from 'amqplib';
import { MessagePublisher } from './types/messagePublisher.interface';
import { MessageSubscriber } from './types/messageSubscriber.interface';
import { LoggingService } from '../logging/loggingService.interface';

export class RabbitMQService implements MessagePublisher, MessageSubscriber {
	private connection: amqp.ChannelModel;
	private channel: amqp.Channel;

	constructor(private url: string, private exchangeName: string, private loggingService: LoggingService) { }

	async connect(): Promise<void> {
		this.loggingService.info(`Connecting to RabbitMQ at ${this.url}`);

		this.connection = await amqp.connect(this.url);
		this.channel = await this.connection.createChannel();

		await this.channel.assertExchange(this.exchangeName, 'fanout', { durable: true });
		this.loggingService.info(
			`RabbitMQ connected. Exchange "${this.exchangeName}" declared.`
		);
	}

	async publish(message: string): Promise<void> {
		if (!this.channel) throw new Error('Channel not initialized');

		this.loggingService.info(
			`Publishing message to exchange "${this.exchangeName}"`
		);

		try {
			this.channel.publish(
				this.exchangeName,
				'',
				Buffer.from(JSON.stringify(message))
			);

			this.loggingService.info(
				`Message published to ${this.exchangeName}: ${message}`
			);
		} catch (err) {
			this.loggingService.error(
				`Failed to publish message to ${this.exchangeName}: ${err}`
			);
			throw err;
		}
	}

	async subscribe(handler: (message: string) => void): Promise<void> {
		if (!this.channel) throw new Error('Channel not initialized');

		const queue = await this.channel.assertQueue('', { exclusive: true });
		await this.channel.bindQueue(queue.queue, this.exchangeName, '');

		this.loggingService.info(
			`Subscribed to RabbitMQ exchange "${this.exchangeName}", queue="${queue.queue}"`
		);

		this.channel.consume(queue.queue, (message) => {
			if (!message) return;

			this.loggingService.info(
				`Message received from exchange ${this.exchangeName}`
			);

			try {
				const data = JSON.parse(message.content.toString());
				handler(data);

				this.channel?.ack(message);
				this.loggingService.info(`Message processed and ACK sent`);
			} catch (error) {
				this.loggingService.error(
					`Error processing message: ${error}`
				);

				this.channel.nack(message, false, true);
				this.loggingService.warn(`Message NACKed and requeued`);
			}
		});
	}
}
