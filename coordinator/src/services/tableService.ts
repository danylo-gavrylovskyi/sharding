import axios from 'axios';
import { ShardService } from './shardService';
import { AddRecordDto } from 'src/dtos/addRecordDto';
import { ConsistentHashRing } from './consistentHashingService';
import { ShardingKeys } from 'src/types/shardingKeys';
import { LoggingService } from './logging/loggingService.interface';
import { MetricsService } from './metricService';
import { MigrationService } from './migrationService';

export class TableService {
	private tables: Map<string, ShardingKeys> = new Map();

	constructor(
		private ring: ConsistentHashRing,
		private shardService: ShardService,
		private migrationService: MigrationService,
		private loggingService: LoggingService,
		private metricsService: MetricsService
	) {
		this.startMetricsCollection();
	}

	listTables() {
		return Array.from(this.tables.entries()).map(([id, def]) => ({
			id,
			...def,
		}));
	}

	createTable(tableId: string, partitionKey: string, sortKey?: string): boolean {
		if (this.tables.has(tableId)) {
			this.loggingService.warn(`Attempted to create table that already exists: ${tableId}`);
			return false;
		}

		this.tables.set(tableId, { partitionKey: partitionKey, sortKey });
		this.loggingService.info(`Table created: id=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey || 'N/A'}`);

		this.metricsService.totalTablesGauge.set(this.tables.size);

		return true;
	}

	async existsRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Checked record existence for non-existent table: ${tableId}`);
			return false;
		}
		if (!this.tables.get(tableId)?.sortKey && sortKey) {
			this.loggingService.warn(`Checked record existence with sortKey for table without sortKey: ${tableId}`);
			return false;
		}

		const shardId = this.getShardId(tableId, partitionKey);
		if (!shardId) {
			this.loggingService.warn(`No shard found for table=${tableId} with partitionKey=${partitionKey}`);
			return false;
		}

		const replicaSet = this.shardService.getReplicaSet(shardId);
		if (!replicaSet?.leader) {
			this.loggingService.warn(`No leader found in replica set for shard=${shardId} when checking record existence`);
			return false;
		}

		const url = `${replicaSet.leader}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.head(url, {
				params: { partitionKey, sortKey },
				timeout: 5000,
			});
			this.loggingService.info(`Record existence check: table=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey || 'N/A'}, exists=${response.status === 200}`);
			return response.status === 200;
		} catch (error) {
			this.loggingService.error(`Error checking record existence in shard at ${replicaSet.leader}: ${error}`);
			return false;
		}
	}

	async getRecord(tableId: string, partitionKey: string, sortKey?: string) {
		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Attempted to get record from non-existent table: ${tableId}`);
			return null;
		}
		if (!this.tables.get(tableId)?.sortKey && sortKey) {
			this.loggingService.warn(`Attempted to get record with sortKey from table without sortKey: ${tableId}`);
			return null;
		}

		const shardId = this.getShardId(tableId, partitionKey);
		if (!shardId) {
			this.loggingService.warn(`No shard found for table=${tableId} with partitionKey=${partitionKey}`);
			return null;
		}

		const records = await this.tryReadFromShard(shardId, tableId, partitionKey, sortKey);
		if (records) return records;

		if (this.migrationService.isMigrating && this.migrationService.oldRing) {
			const keyHash = `${tableId}::${partitionKey}`;
			const oldShardId = this.migrationService.oldRing.getServer(keyHash);

			if (oldShardId && oldShardId !== shardId) {
				this.loggingService.warn(`Key not found on new shard. Trying old shard ${oldShardId} (Migration Fallback)`);
				await this.tryReadFromShard(oldShardId, tableId, partitionKey, sortKey);
			}
		}

		return null;
	}

	async addRecord(tableId: string, dto: AddRecordDto): Promise<boolean> {
		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Attempted to add record to non-existent table: ${tableId}`);
			return false;
		}
		if (!this.tables.get(tableId)?.sortKey && dto.sortKey) {
			this.loggingService.warn(`Attempted to add record with sortKey to table without sortKey: ${tableId}`);
			return false;
		}

		const shardAddress = this.getShardForWrite(tableId, dto.partitionKey);
		if (!shardAddress) {
			this.loggingService.warn(`No shard found for writing to table=${tableId} with partitionKey=${dto.partitionKey}`);
			return false;
		}

		const url = `${shardAddress}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.post(url, dto, { timeout: 5000 });
			this.loggingService.info(`Record added to table=${tableId} at shard ${shardAddress} for partitionKey=${dto.partitionKey}, sortKey=${dto.sortKey || 'N/A'}`);

			this.updateShardDistributionMetrics();

			return response.status === 201;
		} catch (error) {
			this.loggingService.error(`Error adding record to shard at ${shardAddress}: ${error}`);
			return false;
		}
	}

	async deleteRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Attempted to delete record from non-existent table: ${tableId}`);
			return false;
		}
		if (!this.tables.get(tableId)?.sortKey && sortKey) {
			this.loggingService.warn(`Attempted to delete record with sortKey from table without sortKey: ${tableId}`);
			return false;
		}

		const shardAddress = this.getShardForWrite(tableId, partitionKey);
		if (!shardAddress) {
			this.loggingService.warn(`No shard found for deleting from table=${tableId} with partitionKey=${partitionKey}`);
			return false;
		}

		const url = `${shardAddress}/internal/tables/${encodeURIComponent(tableId)}/records`;

		try {
			const response = await axios.delete(url, {
				params: {
					partitionKey,
					sortKey,
				},
				timeout: 5000,
			});
			this.loggingService.info(`Record deleted from table=${tableId} at shard ${shardAddress} for partitionKey=${partitionKey}, sortKey=${sortKey || 'N/A'}`);
			return response.status === 204;
		} catch (error) {
			this.loggingService.error(`Error deleting record from shard at ${shardAddress}: ${error}`);
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

	private async tryReadFromShard(shardId: string, tableId: string, partitionKey: string, sortKey?: string) {
		const replicaSet = this.shardService.getReplicaSet(shardId);
		if (!replicaSet || !replicaSet.readQuorum) {
			this.loggingService.warn(`No replica set or read quorum found for shard=${shardId} when getting record`);
			return null;
		}

		const replicas = this.shardService.getQuorumReplicas(shardId, replicaSet.readQuorum);
		if (replicas.length === 0) {
			this.loggingService.warn(`No replicas available for read quorum on shard=${shardId} when getting record`);
			return null;
		}

		const responses = await Promise.allSettled(
			replicas.map(async (address) => {
				const url = `${address}/internal/tables/${encodeURIComponent(tableId)}/records`;
				try {
					const response = await axios.get(url, {
						params: { partitionKey, sortKey },
						timeout: 5000,
					});
					this.loggingService.info(`Fetched record from shard at ${address} for table=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey || 'N/A'}`);
					return {
						data: response.data,
						timestamp: response.data._timestamp || Date.now(),
						success: true,
					};
				} catch (error) {
					this.loggingService.error(`Error fetching record from shard at ${address}: ${error}`);
					return { success: false };
				}
			})
		);

		const successfulResponses = responses
			.filter(
				(r): r is PromiseFulfilledResult<{ data: any; timestamp: number; success: boolean }> =>
					r.status === 'fulfilled' && r.value.success
			)
			.map((r) => r.value);

		if (successfulResponses.length < replicaSet.readQuorum) {
			this.loggingService.warn(`Insufficient successful responses for read quorum on shard=${shardId}: required=${replicaSet.readQuorum}, received=${successfulResponses.length}`);
			return null;
		}

		const newestVersion = successfulResponses.reduce((newest, current) => {
			return current.timestamp > newest.timestamp ? current : newest;
		}, successfulResponses[0]);
		this.loggingService.info(`Returning newest record timestamp=${newestVersion.timestamp} for table=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey || 'N/A'}`);

		return { data: newestVersion.data };
	}

	private startMetricsCollection(): void {
		setInterval(() => {
			this.updateShardDistributionMetrics();
		}, 30000);
	}

	private updateShardDistributionMetrics(): void {
		const shardKeyCount = new Map<string, number>();

		for (const tableId of this.tables.keys()) {
			for (const key of this.tables.values()) {
				const shardId = this.getShardId(tableId, key.partitionKey);
				if (shardId) {
					shardKeyCount.set(shardId, (shardKeyCount.get(shardId) || 0) + 1);
				}
			}
		}

		this.shardService.updateShardDistribution(
			shardKeyCount
		);
	}
}
