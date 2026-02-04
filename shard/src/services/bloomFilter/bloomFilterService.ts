import os from 'os'
import { LoggingService } from '../logging/loggingService.interface';
import { MetricsService } from '../metricService';
import { BloomFilter } from './bloomFilter';

export class BloomFilterService {
	private filters: Map<string, BloomFilter> = new Map();
	private instance: string;

	constructor(private loggingService: LoggingService, private metricsService: MetricsService) {
		this.instance = process.env.SHARD_NAME || os.hostname();
	}

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

		if (filter && filter.has(key)) {
			this.metricsService.bloomFilterHitsCounter.inc({ table_id: tableId, instance: this.instance });
			return true;
		}

		this.metricsService.bloomFilterMissesCounter.inc({ table_id: tableId, instance: this.instance });
		this.loggingService.warn(`Bloom filter negative for table=${tableId}, key=${key}`);
		return false;
	}
}
