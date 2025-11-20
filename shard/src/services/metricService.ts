import client from 'prom-client';

export class MetricsService {
	private registry = new client.Registry();

	public httpRequestHistogram: client.Histogram<string>;
	public httpErrorCounter: client.Counter<string>;
	public httpThroughputCounter: client.Counter<string>;

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

		this.registry.registerMetric(this.httpRequestHistogram);
		this.registry.registerMetric(this.httpThroughputCounter);
		this.registry.registerMetric(this.httpErrorCounter);
	}

	async metrics() {
		return this.registry.metrics();
	}
}
