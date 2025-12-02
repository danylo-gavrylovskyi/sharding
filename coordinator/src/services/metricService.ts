import client from 'prom-client';

export class MetricsService {
	private registry = new client.Registry();

	public httpRequestHistogram: client.Histogram<string>;
	public httpErrorCounter: client.Counter<string>;
	public httpThroughputCounter: client.Counter<string>;

	// Cluster health metrics
	public totalShardsGauge: client.Gauge<string>;
	public healthyShardsGauge: client.Gauge<string>;
	public unhealthyShardsGauge: client.Gauge<string>;
	public replicaSetsGauge: client.Gauge<string>;

	// Shard distribution metrics
	public shardDistributionGauge: client.Gauge<string>;
	public replicaSetSizeGauge: client.Gauge<string>;
	public leaderCountGauge: client.Gauge<string>;
	public followerCountGauge: client.Gauge<string>;

	// Quorum metrics
	public readQuorumGauge: client.Gauge<string>;
	public writeQuorumGauge: client.Gauge<string>;
	public replicationFactorGauge: client.Gauge<string>;

	// Table distribution metrics
	public totalTablesGauge: client.Gauge<string>;

	constructor(serviceName: string) {
		client.collectDefaultMetrics({ register: this.registry });

		this.httpRequestHistogram = new client.Histogram({
			name: `${serviceName}_request_latency`,
			help: `Request latency in milliseconds for ${serviceName}`,
			labelNames: ['route', 'method'],
			buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
		});

		this.httpErrorCounter = new client.Counter({
			name: `${serviceName}_errors_total`,
			help: `Total number of errors in ${serviceName}`,
			labelNames: ['route', 'method'],
		});

		this.httpThroughputCounter = new client.Counter({
			name: `${serviceName}_requests_total`,
			help: `Request throughput in ${serviceName}`,
			labelNames: ['route', 'method'],
		});

		// Cluster health
		this.totalShardsGauge = new client.Gauge({
			name: `${serviceName}_total_shards`,
			help: 'Total number of registered shards',
		});

		this.healthyShardsGauge = new client.Gauge({
			name: `${serviceName}_healthy_shards`,
			help: 'Number of healthy/responsive shards',
		});

		this.unhealthyShardsGauge = new client.Gauge({
			name: `${serviceName}_unhealthy_shards`,
			help: 'Number of unhealthy/unresponsive shards',
		});

		this.replicaSetsGauge = new client.Gauge({
			name: `${serviceName}_replica_sets_total`,
			help: 'Total number of replica sets',
		});

		// Shard distribution
		this.shardDistributionGauge = new client.Gauge({
			name: `${serviceName}_shard_key_distribution`,
			help: 'Number of keys assigned to each shard',
			labelNames: ['shard_id'],
		});

		this.replicaSetSizeGauge = new client.Gauge({
			name: `${serviceName}_replica_set_size`,
			help: 'Size of each replica set',
			labelNames: ['replica_set_id'],
		});

		this.leaderCountGauge = new client.Gauge({
			name: `${serviceName}_leaders_total`,
			help: 'Total number of leader shards',
		});

		this.followerCountGauge = new client.Gauge({
			name: `${serviceName}_followers_total`,
			help: 'Total number of follower shards',
		});

		// Quorum metrics
		this.readQuorumGauge = new client.Gauge({
			name: `${serviceName}_read_quorum`,
			help: 'Read quorum size per replica set',
			labelNames: ['replica_set_id'],
		});

		this.writeQuorumGauge = new client.Gauge({
			name: `${serviceName}_write_quorum`,
			help: 'Write quorum size per replica set',
			labelNames: ['replica_set_id'],
		});

		this.replicationFactorGauge = new client.Gauge({
			name: `${serviceName}_replication_factor`,
			help: 'Replication factor per replica set',
			labelNames: ['replica_set_id'],
		});

		this.totalTablesGauge = new client.Gauge({
			name: `${serviceName}_tables_total`,
			help: 'Total number of tables in the system',
		});

		this.registry.registerMetric(this.httpRequestHistogram);
		this.registry.registerMetric(this.httpThroughputCounter);
		this.registry.registerMetric(this.httpErrorCounter);
		this.registry.registerMetric(this.totalShardsGauge);
		this.registry.registerMetric(this.healthyShardsGauge);
		this.registry.registerMetric(this.unhealthyShardsGauge);
		this.registry.registerMetric(this.replicaSetsGauge);
		this.registry.registerMetric(this.shardDistributionGauge);
		this.registry.registerMetric(this.replicaSetSizeGauge);
		this.registry.registerMetric(this.leaderCountGauge);
		this.registry.registerMetric(this.followerCountGauge);
		this.registry.registerMetric(this.readQuorumGauge);
		this.registry.registerMetric(this.writeQuorumGauge);
		this.registry.registerMetric(this.replicationFactorGauge);
		this.registry.registerMetric(this.totalTablesGauge);
	}

	async metrics() {
		return this.registry.metrics();
	}
}
