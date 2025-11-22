import { ShardMetadata } from 'src/types/shardMetadata';
import { ShardRole } from '../types/shardRole';
import { ConsistentHashRing } from './consistentHashingService';
import { ReplicaSet } from 'src/types/replicaSet';
import { LoggingService } from './logging/loggingService.interface';

export class ShardService {
	private shards: Map<string, ShardMetadata> = new Map();
	private replicaSets: Map<string, ReplicaSet> = new Map();

	constructor(private ring: ConsistentHashRing, private loggingService: LoggingService) { }

	listShards() {
		return Array.from(this.shards.entries()).map(([id, metadata]) => ({
			id,
			...metadata,
		}));
	}

	getShardAddress(shardId: string): string | null {
		return this.shards.get(shardId)?.address ?? null;
	}

	getReplicaSet(shardId: string): ReplicaSet | null {
		if (!this.shards.has(shardId)) return null;
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

		return chosen
	}

	addShard(shard: ShardMetadata, replicaSetId: string): void {
		this.shards.set(shard.shardId, shard);

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
			replicaSet.followers.push(shard.address);

			this.loggingService.info(
				`ReplicaSet ${replicaSetId}: FOLLOWER added → ${shard.address}`
			);
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

		this.ring.addServer(shard.shardId);
		this.loggingService.info(`Shard ${shard.shardId} added to hash ring.`);
	}

	removeShard(shardId: string): boolean {
		if (!this.shards.has(shardId)) {
			this.loggingService.warn(`Attempted to remove unknown shard: ${shardId}`);
			return false;
		}

		this.shards.delete(shardId);
		this.ring.removeServer(shardId);
		this.loggingService.info(`Shard removed: id=${shardId}`);

		return true;
	}
}
