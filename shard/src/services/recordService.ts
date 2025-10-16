import { BloomFilterService } from './bloomFilter/bloomFilterService';

export class RecordService {
	private tables: Map<string, Map<string, Map<string, Record<string, any>>>> = new Map();

	constructor(private bloomFilterService: BloomFilterService) {}

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

		return partition?.get(sk) || null;
	}

	addRecord(
		tableId: string,
		partitionKey: string,
		record: Record<string, any>,
		sortKey?: string
	): boolean {
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

		return true;
	}

	deleteRecord(tableId: string, partitionKey: string, sortKey?: string): boolean {
		if (!this.tables.has(tableId)) return false;
		const table = this.tables.get(tableId);

		const sk = sortKey || '';
		if (!this.bloomFilterService.has(tableId, `${partitionKey}::${sk}`)) return false;

		if (!table?.has(partitionKey)) return false;
		const partition = table.get(partitionKey);

		const isDeleted = partition?.delete(sk);
		if (!isDeleted) return false;

		if (partition?.size === 0) table.delete(partitionKey);

		return true;
	}
}
