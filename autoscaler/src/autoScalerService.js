import axios from 'axios';
// import { exec as execCb } from 'child_process';
// import { promisify } from 'util';
import Docker from 'dockerode';
// const exec = promisify(execCb);

export class AutoScalerService {
	interval = null;
	coreShardsCount = Number(process.env.CORE_SHARDS_COUNT || 3);
	standbyShardsCount = Number(process.env.STANDBY_SHARDS_COUNT || 2);
	docker = new Docker({ socketPath: '/var/run/docker.sock' });

	activeShards = [];
	standbyShards = [];

	constructor(prometheusUrl, checkIntervalMs = 60000) {
		this.prometheusUrl = prometheusUrl;
		this.checkIntervalMs = checkIntervalMs;

		for (let i = 1; i <= this.coreShardsCount; i++) {
			this.activeShards.push(`shard${i}`);
		}
		for (
			let i = this.coreShardsCount + 1;
			i <= this.coreShardsCount + this.standbyShardsCount;
			i++
		) {
			this.standbyShards.push(`shard${i}`);
		}
	}

	start() {
		if (this.interval) return;

		console.log('Autoscaler started...');
		this.interval = setInterval(() => this.tick(), this.checkIntervalMs);
	}

	stop() {
		if (!this.interval) return;
		clearInterval(this.interval);
		this.interval = null;
	}

	async queryPrometheus(query) {
		const url = `${this.prometheusUrl}/api/v1/query`;

		const res = await axios.get(url, { params: { query } });
		return res.data.data.result;
	}

	async tick() {
		try {
			const cpuQuery = `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)`;
			const cpuData = await this.queryPrometheus(cpuQuery);
			const cpu = Number(cpuData[0].value[1]);

			const latencyQuery = `histogram_quantile(0.99, sum(rate(coordinator_request_latency_bucket[1m])) by (le))`;
			const latencyData = await this.queryPrometheus(latencyQuery);
			const p99Latency = Number(latencyData[0].value[1]);

			console.log('Autoscaler check, CPU =', cpu);
			console.log('Autoscaler check, P99 latency =', p99Latency);

			const CPU_SCALE_UP = 2;
			const CPU_SCALE_DOWN = 1.6;

			const LAT_UP = 0.5;
			// const LAT_DOWN = 0.3;
			// const LAT_UP = 0.0049;
			const LAT_DOWN = 0.001;

			if (cpu > CPU_SCALE_UP || p99Latency > LAT_UP) {
				if (this.standbyShards.length === 0) {
					console.log('No standby shards available to scale up');
					return;
				}

				const nextShard = this.standbyShards.shift();
				console.log('Adding a new shard %s', nextShard);
				// await exec(`docker-compose up -d ${nextShard}`);
				await this.docker.getContainer(nextShard).start();
				this.activeShards.push(nextShard);
			}

			if (cpu < CPU_SCALE_DOWN || p99Latency < LAT_DOWN) {
				if (this.activeShards.length <= this.coreShardsCount) {
					console.log('At minimum core shards, cannot scale down further');
					return;
				}

				console.log('CPU low → removing one shard');
				const shardToStop = this.activeShards.pop();
				// await exec(`docker-compose stop ${shardToStop}`);
				await this.docker.getContainer(shardToStop).stop();
				this.standbyShards.unshift(shardToStop);
			}
		} catch (e) {
			console.error('Autoscaler tick error:', e);
		}
	}
}
