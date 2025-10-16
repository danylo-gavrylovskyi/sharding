import { BloomFilter } from './bloomFilter';

export class BloomFilterService {
	private filters: Map<string, BloomFilter> = new Map();

	createFilter(tableId: string, size = 1024, hashCount = 3) {
		if (!this.filters.has(tableId)) {
			this.filters.set(tableId, new BloomFilter(size, hashCount));
		}
	}

	add(tableId: string, key: string): void {
		const filter = this.filters.get(tableId);
		if (filter) filter.add(key);
	}

	has(tableId: string, key: string): boolean {
		const filter = this.filters.get(tableId);
		return filter ? filter.has(key) : false;
	}
}
