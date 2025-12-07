import axios from 'axios';
import { ShardMetadata } from 'src/types/shardMetadata';
import { ShardRole } from '../types/shardRole';
import { ConsistentHashRing } from './consistentHashingService';
import { ReplicaSet } from 'src/types/replicaSet';
import { LoggingService } from './logging/loggingService.interface';
import { MetricsService } from './metricService';
import EventEmitter from 'events';

export declare interface ShardService {
	on(event: 'topology-change', listener: (oldRing: ConsistentHashRing, newRing: ConsistentHashRing) => void): this;
}

export class ShardService extends EventEmitter {
	private shards: Map<string, ShardMetadata> = new Map();
	private replicaSets: Map<string, ReplicaSet> = new Map();

	private consecutiveFailures: Map<string, number> = new Map();
	private readonly MAX_FAILURES: number = 3;

	constructor(
		private ring: ConsistentHashRing,
		private loggingService: LoggingService,
		private metricsService: MetricsService
	) {
		super();
		this.startHealthChecks();
		this.startMetricsCollection();
	}

	listShards() {
		return Array.from(this.shards.entries()).map(([_, metadata]) => ({
			...metadata,
		}));
	}

	getShardAddress(shardId: string): string | null {
		for (const [address, metadata] of this.shards) {
			if (metadata.shardId === shardId) {
				return address;
			}
		}
		return null;
	}

	getReplicaSet(shardId: string): ReplicaSet | null {
		return this.replicaSets.get(shardId) || null;
	}

	getQuorumReplicas(shardId: string, count: number): string[] {
		const replicaSet = this.replicaSets.get(shardId);
		if (!replicaSet) return [];

		const allReplicas = [replicaSet.leader, ...replicaSet.followers].filter(Boolean);
		if (allReplicas.length === 0) return [];

		const shuffledReplicas = [...allReplicas].sort(() => Math.random() - 0.5);
		const chosen = shuffledReplicas.slice(0, count);

		this.loggingService.info(
			`Selected quorum replicas for shard=${shardId}, R=${count}, chosen=[${chosen.join(', ')}]`
		);

		return chosen;
	}

	addShard(shard: ShardMetadata, replicaSetId: string): void {
		this.shards.set(shard.address, shard);

		if (!this.replicaSets.has(replicaSetId)) {
			this.replicaSets.set(replicaSetId, {
				leader: '',
				followers: [],
				replicationFactor: 0,
				writeQuorum: 1, // W=1 for single-leader
				readQuorum: 0,
			});
		}

		const replicaSet = this.replicaSets.get(replicaSetId);
		if (!replicaSet) return;

		this.loggingService.info(
			`Registering shard: id=${shard.shardId}, address=${shard.address}, role=${shard.role}, replicaSet=${replicaSetId}`
		);

		if (shard.role === ShardRole.LEADER && replicaSet) {
			replicaSet.leader = shard.address;
			this.loggingService.info(
				`ReplicaSet ${replicaSetId}: LEADER assigned → ${shard.address}`
			);
		} else {
			if (!replicaSet.followers.includes(shard.address)) {
				replicaSet.followers.push(shard.address);
				this.loggingService.info(
					`ReplicaSet ${replicaSetId}: FOLLOWER added → ${shard.address}`
				);
			}
		}

		replicaSet.replicationFactor = 1 + replicaSet.followers.length;
		// Calculate R such that R + W > N
		if (replicaSet.replicationFactor !== undefined && replicaSet.writeQuorum !== undefined) {
			replicaSet.readQuorum = Math.max(
				1,
				replicaSet.replicationFactor - replicaSet.writeQuorum + 1
			);
		}

		this.loggingService.info(
			`ReplicaSet ${replicaSetId}: replicationFactor=${replicaSet.replicationFactor}, readQuorum=${replicaSet.readQuorum}`
		);

		const existingShardWithId = Array.from(this.shards.values()).find(
			s => s.shardId === shard.shardId && s.address !== shard.address
		);

		if (!existingShardWithId) {
			const oldRing = this.ring.clone();

			this.ring.addServer(shard.shardId);
			this.loggingService.info(`Shard ${shard.shardId} added to hash ring.`);

			this.loggingService.info('Triggering migration...');
			this.emit('topology-change', oldRing, this.ring);
		} else {
			this.loggingService.info(`Shard ${shard.shardId} already in hash ring, skipping.`);
		}

		this.updateClusterMetrics();
	}

	removeShard(shardAddress: string): boolean {
		const shard = this.shards.get(shardAddress);
		if (!shard) {
			this.loggingService.warn(`Attempted to remove unknown shard at address: ${shardAddress}`);
			return false;
		}

		this.shards.delete(shardAddress);

		const replicaSet = this.replicaSets.get(shard.shardId);
		if (replicaSet) {
			if (replicaSet.leader === shardAddress) {
				replicaSet.leader = '';
			} else {
				const index = replicaSet.followers.indexOf(shardAddress);
				if (index > -1) {
					replicaSet.followers.splice(index, 1);
				}
			}

			replicaSet.replicationFactor = (replicaSet.leader ? 1 : 0) + replicaSet.followers.length;

			if (replicaSet.replicationFactor === 0) {
				this.ring.removeServer(shard.shardId);
				this.loggingService.info(`Shard ${shard.shardId} removed from hash ring (no replicas left).`);
			}
		}

		this.loggingService.info(`Shard removed: address=${shardAddress}, shardId=${shard.shardId}`);

		this.updateClusterMetrics();
		return true;
	}

	private startHealthChecks(): void {
		setInterval(() => {
			this.checkShardHealth();
		}, 30000);
	}

	private async checkShardHealth(): Promise<void> {
		let healthyCount = 0;
		let unhealthyCount = 0;

		const currentAddresses = Array.from(this.shards.keys())

		for (const address of currentAddresses) {
			const shard = this.shards.get(address)
			if (!shard) continue

			try {
				await axios.get(`${address}/internal/health`, { timeout: 2000 });
				if (this.consecutiveFailures.has(address)) {
					this.consecutiveFailures.delete(address)
					this.loggingService.info(`Shard ${shard.shardId} (${address}) recovered.`);
				}
				healthyCount++;
			} catch (error) {
				unhealthyCount++

				const failures = (this.consecutiveFailures.get(address) || 0) + 1
				this.consecutiveFailures.set(address, failures)

				this.loggingService.warn(
					`Shard ${shard.shardId} (${address}) failed health check (${failures}/${this.MAX_FAILURES})`
				);

				if (failures >= this.MAX_FAILURES) {
					this.loggingService.error(
						`Shard ${shard.shardId} is dead. Removing from cluster.`
					);
					this.removeShard(address)
					this.consecutiveFailures.delete(address)
				}
			}
		}

		this.metricsService.healthyShardsGauge.set(healthyCount);
		this.metricsService.unhealthyShardsGauge.set(unhealthyCount);
	}

	private startMetricsCollection(): void {
		setInterval(() => {
			this.updateClusterMetrics();
		}, 15000);
	}

	private updateClusterMetrics(): void {
		this.metricsService.totalShardsGauge.set(this.shards.size);
		this.metricsService.replicaSetsGauge.set(this.replicaSets.size);

		let leaderCount = 0;
		let followerCount = 0;

		for (const shard of this.shards.values()) {
			if (shard.role === ShardRole.LEADER) {
				leaderCount++;
			} else {
				followerCount++;
			}
		}

		this.metricsService.leaderCountGauge.set(leaderCount);
		this.metricsService.followerCountGauge.set(followerCount);

		for (const [replicaSetId, replicaSet] of this.replicaSets) {
			const size = (replicaSet.leader ? 1 : 0) + replicaSet.followers.length;
			this.metricsService.replicaSetSizeGauge.set({ replica_set_id: replicaSetId }, size);

			if (replicaSet.readQuorum !== undefined) {
				this.metricsService.readQuorumGauge.set(
					{ replica_set_id: replicaSetId },
					replicaSet.readQuorum
				);
			}

			if (replicaSet.writeQuorum !== undefined) {
				this.metricsService.writeQuorumGauge.set(
					{ replica_set_id: replicaSetId },
					replicaSet.writeQuorum
				);
			}

			if (replicaSet.replicationFactor !== undefined) {
				this.metricsService.replicationFactorGauge.set(
					{ replica_set_id: replicaSetId },
					replicaSet.replicationFactor
				);
			}
		}
	}

	public updateShardDistribution(shardKeyDistribution: Map<string, number>): void {
		for (const [shardId, keyCount] of shardKeyDistribution) {
			this.metricsService.shardDistributionGauge.set(
				{ shard_id: shardId },
				keyCount
			);
		}
	}
}
