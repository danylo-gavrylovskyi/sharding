import client from 'prom-client';

export class MetricsService {
	private registry = new client.Registry();

	public httpRequestHistogram: client.Histogram<string>;
	public httpErrorCounter: client.Counter<string>;
	public httpThroughputCounter: client.Counter<string>;

	// Replication lag metrics
	public replicationLagGauge: client.Gauge<string>;
	public lastAppliedLogIndexGauge: client.Gauge<string>;
	public replicationMessagesProcessedCounter: client.Counter<string>;
	public replicationMessagesPublishedCounter: client.Counter<string>;
	public replicationErrorsCounter: client.Counter<string>;
	public replicationDelayHistogram: client.Histogram<string>;

	// Storage metrics
	public totalRecordsGauge: client.Gauge<string>;
	public recordsPerTableGauge: client.Gauge<string>;
	public bloomFilterSizeGauge: client.Gauge<string>;

	// Operation metrics
	public recordCreatesCounter: client.Counter<string>;
	public recordDeletesCounter: client.Counter<string>;
	public recordReadsCounter: client.Counter<string>;
	public bloomFilterHitsCounter: client.Counter<string>;
	public bloomFilterMissesCounter: client.Counter<string>;

	constructor(serviceName: string) {
		client.collectDefaultMetrics({ register: this.registry });

		this.httpRequestHistogram = new client.Histogram({
			name: `${serviceName}_request_latency`,
			help: `Request latency in milliseconds for ${serviceName}`,
			labelNames: ['route', 'method', 'instance'],
			buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
		});

		this.httpErrorCounter = new client.Counter({
			name: `${serviceName}_errors_total`,
			help: `Total number of errors in ${serviceName}`,
			labelNames: ['route', 'method', 'instance'],
		});

		this.httpThroughputCounter = new client.Counter({
			name: `${serviceName}_requests_total`,
			help: `Request throughput in ${serviceName}`,
			labelNames: ['route', 'method', 'instance'],
		});

		// Replication lag metrics
		this.replicationLagGauge = new client.Gauge({
			name: `${serviceName}_replication_lag_seconds`,
			help: 'Time lag between message creation and application (seconds)',
			labelNames: ['instance']
		});

		this.lastAppliedLogIndexGauge = new client.Gauge({
			name: `${serviceName}_last_applied_log_index`,
			help: 'Last applied replication log index',
			labelNames: ['instance'],
		});

		this.replicationMessagesProcessedCounter = new client.Counter({
			name: `${serviceName}_replication_messages_processed_total`,
			help: 'Total number of replication messages processed',
			labelNames: ['operation', 'instance'],
		});

		this.replicationMessagesPublishedCounter = new client.Counter({
			name: `${serviceName}_replication_messages_published_total`,
			help: 'Total number of replication messages published',
			labelNames: ['operation', 'instance'],
		});

		this.replicationErrorsCounter = new client.Counter({
			name: `${serviceName}_replication_errors_total`,
			help: 'Total number of replication errors',
			labelNames: ['operation', 'error_type', 'instance'],
		});

		this.replicationDelayHistogram = new client.Histogram({
			name: `${serviceName}_replication_delay_seconds`,
			help: 'Histogram of replication message processing delay',
			labelNames: ['instance'],
			buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
		});

		// Storage metrics
		this.totalRecordsGauge = new client.Gauge({
			name: `${serviceName}_total_records`,
			help: 'Total number of records stored',
			labelNames: ['instance'],
		});

		this.recordsPerTableGauge = new client.Gauge({
			name: `${serviceName}_records_per_table`,
			help: 'Number of records per table',
			labelNames: ['table_id', 'instance'],
		});

		this.bloomFilterSizeGauge = new client.Gauge({
			name: `${serviceName}_bloom_filter_size`,
			help: 'Size of bloom filter per table',
			labelNames: ['table_id', 'instance'],
		});

		// Operation metrics
		this.recordCreatesCounter = new client.Counter({
			name: `${serviceName}_record_creates_total`,
			help: 'Total number of record create operations',
			labelNames: ['table_id', 'instance'],
		});

		this.recordDeletesCounter = new client.Counter({
			name: `${serviceName}_record_deletes_total`,
			help: 'Total number of record delete operations',
			labelNames: ['table_id', 'instance'],
		});

		this.recordReadsCounter = new client.Counter({
			name: `${serviceName}_record_reads_total`,
			help: 'Total number of record read operations',
			labelNames: ['table_id', 'instance'],
		});

		this.bloomFilterHitsCounter = new client.Counter({
			name: `${serviceName}_bloom_filter_hits_total`,
			help: 'Total number of bloom filter hits',
			labelNames: ['table_id', 'instance'],
		});

		this.bloomFilterMissesCounter = new client.Counter({
			name: `${serviceName}_bloom_filter_misses_total`,
			help: 'Total number of bloom filter misses',
			labelNames: ['table_id', 'instance'],
		});

		this.registry.registerMetric(this.httpRequestHistogram);
		this.registry.registerMetric(this.httpThroughputCounter);
		this.registry.registerMetric(this.httpErrorCounter);
		this.registry.registerMetric(this.replicationLagGauge);
		this.registry.registerMetric(this.lastAppliedLogIndexGauge);
		this.registry.registerMetric(this.replicationMessagesProcessedCounter);
		this.registry.registerMetric(this.replicationMessagesPublishedCounter);
		this.registry.registerMetric(this.replicationErrorsCounter);
		this.registry.registerMetric(this.replicationDelayHistogram);
		this.registry.registerMetric(this.totalRecordsGauge);
		this.registry.registerMetric(this.recordsPerTableGauge);
		this.registry.registerMetric(this.bloomFilterSizeGauge);
		this.registry.registerMetric(this.recordCreatesCounter);
		this.registry.registerMetric(this.recordDeletesCounter);
		this.registry.registerMetric(this.recordReadsCounter);
		this.registry.registerMetric(this.bloomFilterHitsCounter);
		this.registry.registerMetric(this.bloomFilterMissesCounter);
	}

	async metrics() {
		return this.registry.metrics();
	}
}
