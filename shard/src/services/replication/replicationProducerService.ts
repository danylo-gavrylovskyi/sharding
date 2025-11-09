import { retry } from '../../utils/retry';
import { MessagePublisher } from '../messageQueue/types/messagePublisher.interface';
import { ReplicationMessage } from './types/replicationMessage.type';
import { ReplicationOperation } from './types/replicationOperation.enum';

export class ReplicationProducerService {
	constructor(private publisher: MessagePublisher) {}

	async replicateCreateRecord(
		logIndex: number,
		tableId: string,
		partitionKey: string,
		record: Record<string, any>,
		sortKey?: string
	) {
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
	}

	async replicateDeleteRecord(
		logIndex: number,
		tableId: string,
		partitionKey: string,
		sortKey?: string
	) {
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
	}
}
