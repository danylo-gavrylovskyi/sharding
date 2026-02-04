import os from 'os';
import { ShardRole } from '../types/shardRole.enum';
import { BloomFilterService } from './bloomFilter/bloomFilterService';
import { LoggingService } from './logging/loggingService.interface';
import { ReplicationProducerService } from './replication/replicationProducerService';
import { MetricsService } from './metricService';

export class RecordService {
	private tables: Map<string, Map<string, Map<string, Record<string, any>>>> = new Map();
	private instance: string;

	constructor(
		private bloomFilterService: BloomFilterService,
		private role: ShardRole,
		private loggingService: LoggingService,
		private metricsService: MetricsService,
		private replicationService?: ReplicationProducerService
	) {
		this.instance = process.env.SHARD_NAME || os.hostname();
		this.startMetricsCollection();
	}

	getTablePartitionKeys(tableId: string): string[] {
		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Attempted to get partition keys for non-existent table: ${tableId}`);
			return [];
		}

		const table = this.tables.get(tableId);
		const partitionKeys = Array.from(table?.keys() || []);
		this.loggingService.info(`Retrieved partition keys for table=${tableId}: ${partitionKeys.join(', ')}`);
		return partitionKeys;
	}

	existsRecord(tableId: string, partitionKey: string, sortKey?: string): boolean {
		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Checked record existence for non-existent table: ${tableId}`);
			return false;
		}
		const table = this.tables.get(tableId);

		const sk = sortKey || '';

		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sk}`)) return false;

		if (!table?.has(partitionKey)) {
			this.loggingService.warn(`No partition found for table=${tableId} with partitionKey=${partitionKey}`);
			return false;
		}
		const partition = table.get(partitionKey);

		const exists = partition?.has(sk) || false;
		this.loggingService.info(`Record existence check: table=${tableId}, partitionKey=${partitionKey}, sortKey=${sk}, exists=${exists}`);
		return exists;
	}

	getRecord(tableId: string, partitionKey: string, sortKey?: string) {
		this.metricsService.recordReadsCounter.inc({ table_id: tableId, instance: this.instance });

		const table = this.tables.get(tableId);
		if (!table) {
			this.loggingService.warn(`Attempted to get record for non-existent table: ${tableId}`);
			return null;
		}

		const partition = table.get(partitionKey);
		if (!partition) {
			this.loggingService.warn(`No partition found for table=${tableId} with partitionKey=${partitionKey}`);
			return null;
		}

		if (sortKey === undefined) {
			return Array.from(partition.values())
		}

		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sortKey}`)) return null;

		const record = partition?.get(sortKey);
		if (!record) {
			this.loggingService.warn(`No record found in table=${tableId} for partitionKey=${partitionKey}, sortKey=${sortKey}`);
			return null;
		}

		this.loggingService.info(`Record retrieved: table=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);
		return record;
	}

	async addRecord(
		tableId: string,
		record: Record<string, any>,
	): Promise<boolean> {
		if (this.role === ShardRole.LEADER) {
			record._timestamp = Date.now()
		}

		this.metricsService.recordCreatesCounter.inc({ table_id: tableId, instance: this.instance });

		if (!this.tables.has(tableId)) {
			this.tables.set(tableId, new Map());
			this.bloomFilterService.createFilter(tableId);
		}
		const table = this.tables.get(tableId);

		const partitionKey = record.partitionKey;
		if (!table?.has(partitionKey)) table?.set(partitionKey, new Map());
		const partition = table?.get(partitionKey);

		const sortKey = record.sortKey;
		const sk = sortKey || '';

		const existingRecord = partition?.get(sk)
		if (existingRecord && existingRecord._timestamp > record._timestamp) {
			this.loggingService.warn(`Attempted to add older record to table=${tableId}, partitionKey=${partitionKey}, sortKey=${sk}`);
			return false;
		}
		partition?.set(sk, record);

		this.bloomFilterService.add(tableId, `${partitionKey}::${sk}`);

		if (this.role === ShardRole.LEADER && this.replicationService) {
			await this.replicationService.replicateCreateRecord(
				tableId,
				partitionKey,
				record,
				sortKey
			);
		}

		this.loggingService.info(`Record added: table=${tableId}, partitionKey=${partitionKey}, sortKey=${sk}`);
		return true;
	}

	async deleteRecord(tableId: string, partitionKey: string, sortKey?: string): Promise<boolean> {
		this.metricsService.recordDeletesCounter.inc({ table_id: tableId, instance: this.instance });

		if (!this.tables.has(tableId)) {
			this.loggingService.warn(`Attempted to delete record from non-existent table: ${tableId}`);
			return false;
		}
		const table = this.tables.get(tableId);

		if (sortKey === undefined) {
			table?.delete(partitionKey);
			return true
		}

		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sortKey}`)) return false;

		if (!table?.has(partitionKey)) {
			this.loggingService.warn(`No partition found for table=${tableId} with partitionKey=${partitionKey}`);
			return false;
		}
		const partition = table.get(partitionKey);

		const isDeleted = partition?.delete(sortKey);
		if (!isDeleted) {
			this.loggingService.warn(`No record found to delete in table=${tableId} for partitionKey=${partitionKey}, sortKey=${sortKey}`);
			return false;
		}

		if (partition?.size === 0) table.delete(partitionKey);

		if (this.role === ShardRole.LEADER && this.replicationService) {
			await this.replicationService.replicateDeleteRecord(
				tableId,
				partitionKey,
				sortKey
			);
		}

		this.loggingService.info(`Record deleted: table=${tableId}, partitionKey=${partitionKey}, sortKey=${sortKey}`);
		return true;
	}

	private startMetricsCollection(): void {
		setInterval(() => {
			this.updateStorageMetrics();
		}, 15000);
	}

	private updateStorageMetrics(): void {
		let totalRecords = 0;

		for (const [tableId, table] of this.tables) {
			let tableRecordCount = 0;

			for (const partition of table.values()) {
				tableRecordCount += partition.size;
			}

			totalRecords += tableRecordCount;
			this.metricsService.recordsPerTableGauge.set(
				{ table_id: tableId, instance: this.instance },
				tableRecordCount
			);
		}

		this.metricsService.totalRecordsGauge.set({ instance: this.instance }, totalRecords);
	}
}