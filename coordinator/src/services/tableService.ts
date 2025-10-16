import { TableDef } from 'src/types/types';
import { ShardService } from './shardService';
import { AddRecordDto } from 'src/dtos/addRecordDto';
import axios from 'axios';
import { ConsistentHashRing } from './consistentHashingService';

export class TableService {
	private tables: Map<string, TableDef> = new Map();

	constructor(private ring: ConsistentHashRing, private shardService: ShardService) {}

	listTables() {
		return Array.from(this.tables.entries()).map(([id, def]) => ({
			id,
			...def,
		}));
	}

	createTable(tableId: string, partitionKey: string, sortKey?: string): boolean {
		if (this.tables.has(tableId)) {
			return false;
		}

		this.tables.set(tableId, { partitionKey: partitionKey, sortKey });

		return true;
	}

	async existsRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		if (!this.tables.has(tableId)) return false;
		if (!this.tables.get(tableId)?.sortKey && sortKey) return false;

		const shardAddress = this.getShardForPartitionKey(tableId, partitionKey);
		if (!shardAddress) return false;

		const url = `${shardAddress}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.head(url, {
				params: { partitionKey, sortKey },
				timeout: 5000,
			});
			return response.status === 200;
		} catch (error) {
			console.error('Error fetching record from shard:', error);
			return false;
		}
	}

	async getRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		if (!this.tables.has(tableId)) return false;
		if (!this.tables.get(tableId)?.sortKey && sortKey) return false;

		const shardAddress = this.getShardForPartitionKey(tableId, partitionKey);
		if (!shardAddress) return false;

		const url = `${shardAddress}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.get(url, {
				params: { partitionKey, sortKey },
				timeout: 5000,
			});
			return response.status === 200;
		} catch (error) {
			console.error('Error fetching record from shard:', error);
			return false;
		}
	}

	async addRecord(tableId: string, dto: AddRecordDto): Promise<boolean> {
		if (!this.tables.has(tableId)) return false;
		if (!this.tables.get(tableId)?.sortKey && dto.sortKey) return false;

		const shardAddress = this.getShardForPartitionKey(tableId, dto.partitionKey);
		if (!shardAddress) return false;

		const url = `${shardAddress}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.post(url, dto, { timeout: 5000 });
			return response.status === 201;
		} catch (error) {
			console.error('Error adding record to shard:', error);
			return false;
		}
	}

	async deleteRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		if (!this.tables.has(tableId)) return false;
		if (!this.tables.get(tableId)?.sortKey && sortKey) return false;

		const shardAddress = this.getShardForPartitionKey(tableId, partitionKey);
		if (!shardAddress) return false;

		const url = `${shardAddress}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.delete(url, {
				params: {
					partitionKey,
					sortKey,
				},
				timeout: 5000,
			});
			return response.status === 204;
		} catch (error) {
			console.error('Error deleting record from shard:', error);
			return false;
		}
	}

	private getShardForPartitionKey(tableId: string, partitionKey: string): string | null {
		if (!this.tables.has(tableId)) return null;

		const keyHash = `${tableId}::${partitionKey}`;

		const shardId = this.ring.getServer(keyHash);
		if (!shardId) return null;

		const shardAddress = this.shardService.getShardAddress(shardId);
		return shardAddress;
	}
}
