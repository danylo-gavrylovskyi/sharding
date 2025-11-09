import { ShardService } from './shardService';
import { AddRecordDto } from 'src/dtos/addRecordDto';
import axios from 'axios';
import { ConsistentHashRing } from './consistentHashingService';
import { ShardingKeys } from 'src/types/shardingKeys';

export class TableService {
	private tables: Map<string, ShardingKeys> = new Map();

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

		const shardId = this.getShardId(tableId, partitionKey);
		if (!shardId) return false;

		const replicaSet = this.shardService.getReplicaSet(shardId);
		if (!replicaSet?.leader) return false;

		const url = `${replicaSet.leader}/internal/tables/${encodeURIComponent(tableId)}/records`;

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

	async getRecord(tableId: string, partitionKey: string, sortKey?: string) {
		if (!this.tables.has(tableId)) return null;
		if (!this.tables.get(tableId)?.sortKey && sortKey) return null;

		const shardId = this.getShardId(tableId, partitionKey);
		if (!shardId) return null;

		const replicaSet = this.shardService.getReplicaSet(shardId);
		if (!replicaSet || !replicaSet.readQuorum) return null;

		const replicas = this.shardService.getQuorumReplicas(shardId, replicaSet.readQuorum);
		if (replicas.length === 0) return null;

		const responses = await Promise.allSettled(
			replicas.map(async (address) => {
				const url = `${address}/internal/tables/${encodeURIComponent(tableId)}/records`;
				try {
					const response = await axios.get(url, {
						params: { partitionKey, sortKey },
						timeout: 5000,
					});
					return {
						data: response.data,
						version: response.data._version || 0,
						success: true,
					};
				} catch (error) {
					console.error(`Error fetching record from shard at ${address}:`, error);
					return { success: false };
				}
			})
		);

		const successfulResponses = responses
			.filter(
				(r): r is PromiseFulfilledResult<{ data: any; version: number; success: boolean }> =>
					r.status === 'fulfilled' && r.value.success
			)
			.map((r) => r.value);

		if (successfulResponses.length < replicaSet.readQuorum) {
			console.error(
				`Failed to achieve read quorum. Got ${successfulResponses.length} responses, needed ${replicaSet.readQuorum}`
			);
			return null;
		}

		const newestVersion = successfulResponses.reduce((newest, current) => {
			return current.version > newest.version ? current : newest;
		}, successfulResponses[0]);

		return { data: newestVersion.data };
	}

	async addRecord(tableId: string, dto: AddRecordDto): Promise<boolean> {
		if (!this.tables.has(tableId)) return false;
		if (!this.tables.get(tableId)?.sortKey && dto.sortKey) return false;

		const shardAddress = this.getShardForWrite(tableId, dto.partitionKey);
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

		const shardAddress = this.getShardForWrite(tableId, partitionKey);
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

	private getShardForWrite(tableId: string, partitionKey: string): string | null {
		const shardId = this.getShardId(tableId, partitionKey);
		if (!shardId) return null;

		const shardAddress = this.shardService.getReplicaSet(shardId);
		return shardAddress?.leader || null;
	}

	private getShardId(tableId: string, partitionKey: string): string | null {
		const keyHash = `${tableId}::${partitionKey}`;
		return this.ring.getServer(keyHash);
	}
}
