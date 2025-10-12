import { ConsistentHashRing } from 'src/consistentHashRing';
import { ShardInfo } from 'src/types';

export class ShardService {
	private shards: Map<string, ShardInfo> = new Map();

	constructor(private ring: ConsistentHashRing) {}

	listShards() {
		return Array.from(this.shards.entries()).map(([id, meta]) => ({
			id,
			addr: meta.address,
		}));
	}

	getShardAddress(shardId: string): string | null {
		const shard = this.shards.get(shardId);
		return shard ? shard.address : null;
	}

	addShard(shardId: string, address: string): boolean {
		if (this.shards.has(shardId)) {
			return false;
		}

		this.shards.set(shardId, { address });
		this.ring.addServer(shardId);

		return true;
	}

	removeShard(shardId: string): boolean {
		if (!this.shards.has(shardId)) {
			return false;
		}

		this.shards.delete(shardId);
		this.ring.removeServer(shardId);

		return true;
	}
}
