import { retry } from '../../utils/retry';
import { LoggingService } from '../logging/loggingService.interface';
import { MessagePublisher } from '../messageQueue/types/messagePublisher.interface';
import { ReplicationMessage } from './types/replicationMessage.type';
import { ReplicationOperation } from './types/replicationOperation.enum';

export class ReplicationProducerService {
	constructor(private publisher: MessagePublisher, private loggingService: LoggingService) { }

	async replicateCreateRecord(
		logIndex: number,
		tableId: string,
		partitionKey: string,
		record: Record<string, any>,
		sortKey?: string
	) {
		this.loggingService.info(`Replicating CREATE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);

		const message: ReplicationMessage = {
			logIndex,
			version: 0, // TBD
			timestamp: Date.now(),
			operation: ReplicationOperation.CREATE,
			tableId,
			partitionKey,
			sortKey,
			record,
		};

		await retry(async () => {
			await this.publisher.publish(message);
		});

		this.loggingService.info(`Successfully replicated CREATE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);
	}

	async replicateDeleteRecord(
		logIndex: number,
		tableId: string,
		partitionKey: string,
		sortKey?: string
	) {
		this.loggingService.info(`Replicating DELETE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);

		const message: ReplicationMessage = {
			logIndex,
			version: 0, // TBD
			timestamp: Date.now(),
			operation: ReplicationOperation.DELETE,
			tableId,
			partitionKey,
			sortKey,
		};

		await retry(async () => {
			await this.publisher.publish(message);
		});

		this.loggingService.info(`Successfully replicated DELETE record: tableId=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);
	}
}
