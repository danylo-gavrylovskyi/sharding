import { Request, Response } from 'express';
import { ShardService } from 'src/services/shardService';

export class ShardController {
	constructor(private shardService: ShardService) {}

	async listShards(_: Request, res: Response) {
		const list = this.shardService.listShards();
		res.json({ shards: list });
	}

	async addShard(req: Request, res: Response) {
		const { shardId, address } = req.body;
		if (!shardId || !address) {
			return res.status(400).json({ error: 'shardId and address are required' });
		}

		if (!this.shardService.addShard(shardId, address)) {
			return res.status(409).json({ error: 'Shard with this ID already exists' });
		}

		return res.status(201);
	}

	async removeShard(req: Request, res: Response) {
		const { shardId } = req.params;
		if (!shardId) {
			return res.status(400).json({ error: 'shardId is required' });
		}

		if (!this.shardService.removeShard(shardId)) {
			return res.status(404).json({ error: 'Shard not found' });
		}

		return res.status(204);
	}
}
