import { ShardRole } from '../types/shardRole.enum';
import { BloomFilterService } from './bloomFilter/bloomFilterService';
import { ReplicationProducerService } from './replication/replicationProducerService';

export class RecordService {
	private tables: Map<string, Map<string, Map<string, Record<string, any>>>> = new Map();
	private logIndex = 0;

	constructor(
		private bloomFilterService: BloomFilterService,
		private role: ShardRole,
		private replicationService?: ReplicationProducerService
	) {}

	existsRecord(tableId: string, partitionKey: string, sortKey?: string): boolean {
		if (!this.tables.has(tableId)) return false;
		const table = this.tables.get(tableId);

		const sk = sortKey || '';
		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sk}`)) return false;

		if (!table?.has(partitionKey)) return false;
		const partition = table.get(partitionKey);

		return partition?.has(sk) || false;
	}

	getRecord(tableId: string, partitionKey: string, sortKey?: string): Record<string, any> | null {
		if (!this.tables.has(tableId)) return null;
		const table = this.tables.get(tableId);

		const sk = sortKey || '';
		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sk}`)) return null;

		if (!table?.has(partitionKey)) return null;
		const partition = table.get(partitionKey);

		const record = partition?.get(sk);
		if (!record) return null;

		if (!record._version) {
			record._version = this.logIndex;
		}

		return record;
	}

	async addRecord(
		tableId: string,
		partitionKey: string,
		record: Record<string, any>,
		sortKey?: string
	): Promise<boolean> {
		this.logIndex++;
		record._version = this.logIndex;
		if (!this.tables.has(tableId)) {
			this.tables.set(tableId, new Map());
			this.bloomFilterService.createFilter(tableId);
		}
		const table = this.tables.get(tableId);

		if (!table?.has(partitionKey)) table?.set(partitionKey, new Map());
		const partition = table?.get(partitionKey);

		const sk = sortKey || '';
		partition?.set(sk, record);
		this.bloomFilterService.add(tableId, `${partitionKey}::${sk}`);

		if (this.role === ShardRole.LEADER && this.replicationService) {
			await this.replicationService.replicateCreateRecord(
				this.logIndex,
				tableId,
				partitionKey,
				record,
				sortKey
			);
		}

		console.log(
			`Record ${record} added to table ${tableId} with partitionKey ${partitionKey} and sortKey ${sk}`
		);

		return true;
	}

	async deleteRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		if (!this.tables.has(tableId)) return false;
		const table = this.tables.get(tableId);

		const sk = sortKey || '';
		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sk}`)) return false;

		if (!table?.has(partitionKey)) return false;
		const partition = table.get(partitionKey);

		const isDeleted = partition?.delete(sk);
		if (!isDeleted) return false;

		if (partition?.size === 0) table.delete(partitionKey);

		this.logIndex++;
		if (this.role === ShardRole.LEADER && this.replicationService) {
			await this.replicationService.replicateDeleteRecord(
				this.logIndex,
				tableId,
				partitionKey,
				sortKey
			);
		}

		return true;
	}
}
