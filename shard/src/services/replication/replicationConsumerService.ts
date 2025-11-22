import { LoggingService } from '../logging/loggingService.interface';
import { MessageSubscriber } from '../messageQueue/types/messageSubscriber.interface';
import { OffsetStoreService } from '../offsetStore/offsetStoreService.interface';
import { RecordService } from '../recordService';
import { ReplicationMessage } from './types/replicationMessage.type';
import { ReplicationOperation } from './types/replicationOperation.enum';

export class ReplicationConsumerService {
	private lastOffset: number;

	constructor(
		private subscriber: MessageSubscriber,
		private recordService: RecordService,
		private offsetStoreService: OffsetStoreService,
		private loggingService: LoggingService
	) {
		this.lastOffset = offsetStoreService.load();
	}

	async start() {
		await this.subscriber.subscribe(async (message: ReplicationMessage) => {
			if (message.logIndex <= this.lastOffset) {
				this.loggingService.warn(`Skipped replayed message logIndex=${message.logIndex}`);
				return;
			}

			this.loggingService.info(`Applying replication: ${message.operation} table=${message.tableId} pk=${message.partitionKey} logIndex=${message.logIndex}`);

			switch (message.operation) {
				case ReplicationOperation.CREATE:
					await this.recordService.addRecord(
						message.tableId,
						message.partitionKey,
						message.record!,
						message.sortKey
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

			this.loggingService.info(
				`Applied replication: ${message.operation} table=${message.tableId} pk=${message.partitionKey} logIndex=${message.logIndex}`
			);

			this.lastOffset = message.logIndex;
			this.offsetStoreService.save(this.lastOffset);
		});
	}
}
