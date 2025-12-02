import os from 'os';
import { retry } from '../../utils/retry';
import { LoggingService } from '../logging/loggingService.interface';
import { MessagePublisher } from '../messageQueue/types/messagePublisher.interface';
import { MetricsService } from '../metricService';
import { ReplicationMessage } from './types/replicationMessage.type';
import { ReplicationOperation } from './types/replicationOperation.enum';

export class ReplicationProducerService {
	private instance: string;
	private logIndex: number;

	constructor(
		private publisher: MessagePublisher,
		private loggingService: LoggingService,
		private metricsService: MetricsService
	) {
		this.instance = process.env.SHARD_NAME || os.hostname();
		this.logIndex = 0;
	}

	async replicateCreateRecord(
		tableId: string,
		partitionKey: string,
		record: Record<string, any>,
		sortKey?: string
	) {
		this.loggingService.info(`Replicating CREATE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);

		const message: ReplicationMessage = {
			logIndex: this.logIndex,
			version: 0,
			timestamp: Date.now(),
			operation: ReplicationOperation.CREATE,
			tableId,
			partitionKey,
			sortKey,
			record,
		};

		try {
			await retry(async () => {
				await this.publisher.publish(message);
			});

			this.logIndex++;
			this.metricsService.lastAppliedLogIndexGauge.set({ instance: this.instance }, this.logIndex);

			this.metricsService.replicationMessagesPublishedCounter.inc({
				operation: ReplicationOperation.CREATE,
				instance: this.instance,
			});

			this.loggingService.info(`Successfully replicated CREATE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);
		} catch (error) {
			this.loggingService.error(`Failed to replicate CREATE record: tableId=${tableId}, error=${error}`);

			this.metricsService.replicationErrorsCounter.inc({
				operation: ReplicationOperation.CREATE,
				error_type: 'publish_error',
				instance: this.instance,
			});

			throw error;
		}
	}

	async replicateDeleteRecord(
		tableId: string,
		partitionKey: string,
		sortKey?: string
	) {
		this.loggingService.info(`Replicating DELETE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);

		const message: ReplicationMessage = {
			logIndex: this.logIndex,
			version: 0,
			timestamp: Date.now(),
			operation: ReplicationOperation.DELETE,
			tableId,
			partitionKey,
			sortKey,
		};

		try {
			await retry(async () => {
				await this.publisher.publish(message);
			});

			this.logIndex++;
			this.metricsService.lastAppliedLogIndexGauge.set({ instance: this.instance }, this.logIndex);

			this.metricsService.replicationMessagesPublishedCounter.inc({
				operation: ReplicationOperation.DELETE,
				instance: this.instance,
			});

			this.loggingService.info(`Successfully replicated DELETE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);
		} catch (error) {
			this.loggingService.error(`Failed to replicate DELETE record: tableId=${tableId}, error=${error}`);

			this.metricsService.replicationErrorsCounter.inc({
				operation: ReplicationOperation.DELETE,
				error_type: 'publish_error',
				instance: this.instance,
			});

			throw error;
		}
	}
}
