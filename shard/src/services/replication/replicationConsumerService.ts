import os from 'os';
import { LoggingService } from '../logging/loggingService.interface';
import { MessageSubscriber } from '../messageQueue/types/messageSubscriber.interface';
import { OffsetStoreService } from '../offsetStore/offsetStoreService.interface';
import { RecordService } from '../recordService';
import { MetricsService } from '../metricService';
import { ReplicationMessage } from './types/replicationMessage.type';
import { ReplicationOperation } from './types/replicationOperation.enum';

export class ReplicationConsumerService {
	private lastOffset: number;
	private instance: string;

	constructor(
		private subscriber: MessageSubscriber,
		private recordService: RecordService,
		private offsetStoreService: OffsetStoreService,
		private loggingService: LoggingService,
		private metricsService: MetricsService
	) {
		this.instance = process.env.SHARD_NAME || os.hostname();
		this.lastOffset = offsetStoreService.load();

		this.metricsService.lastAppliedLogIndexGauge.set({ instance: this.instance }, this.lastOffset);
	}

	async start() {
		await this.subscriber.subscribe(async (message: ReplicationMessage) => {
			const startTime = Date.now();

			if (message.logIndex <= this.lastOffset) {
				this.loggingService.warn(`Skipped replayed message logIndex=${message.logIndex}`);
				return;
			}

			this.loggingService.info(`Applying replication: ${message.operation} table=${message.tableId} pk=${message.partitionKey} logIndex=${message.logIndex}`);

			const record = {
				partitionKey: message.partitionKey,
				sortKey: message.sortKey,
				...message.record
			}

			try {
				switch (message.operation) {
					case ReplicationOperation.CREATE:
						await this.recordService.addRecord(
							message.tableId,
							record
						);
						break;
					case ReplicationOperation.DELETE:
						await this.recordService.deleteRecord(
							message.tableId,
							message.partitionKey,
							message.sortKey
						);
						break;
				}

				const now = Date.now();
				const replicationLag = (now - message.timestamp) / 1000;
				this.metricsService.replicationLagGauge.set({ instance: this.instance }, replicationLag);

				const processingDelay = (now - startTime) / 1000;
				this.metricsService.replicationDelayHistogram.observe({ instance: this.instance }, processingDelay);

				this.metricsService.replicationMessagesProcessedCounter.inc({
					operation: message.operation,
					instance: this.instance,
				});

				this.loggingService.info(
					`Applied replication: ${message.operation} table=${message.tableId} pk=${message.partitionKey} logIndex=${message.logIndex} lag=${replicationLag.toFixed(3)}s`
				);

				this.lastOffset = message.logIndex;
				this.offsetStoreService.save(this.lastOffset);

				this.metricsService.lastAppliedLogIndexGauge.set({ instance: this.instance }, this.lastOffset);
			} catch (error) {
				this.loggingService.error(
					`Error applying replication: ${message.operation} table=${message.tableId} error=${error}`
				);

				this.metricsService.replicationErrorsCounter.inc({
					operation: message.operation,
					error_type: 'processing_error',
					instance: this.instance,
				});

				throw error;
			}
		});
	}
}
