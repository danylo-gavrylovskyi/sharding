import { Request, Response } from 'express';
import { ShardService } from 'src/services/shardService';
import { ShardMetadata } from 'src/types/shardMetadata';

export class ShardController {
	constructor(private shardService: ShardService) {}

	async listShards(_: Request, res: Response) {
		const list = this.shardService.listShards();
		res.json({ shards: list });
	}

	async addShard(req: Request, res: Response) {
		const { shardId, address, role }: ShardMetadata = req.body;
		if (!shardId || !address || !role) {
			return res.status(400).json({ error: 'shardId, address, and role are required' });
		}
		console.log('Received shard registration:', req.body);

		this.shardService.addShard({ shardId, address, role }, shardId);

		return res.sendStatus(201);
	}

	async removeShard(req: Request, res: Response) {
		const { shardId } = req.params;
		if (!shardId) {
			return res.status(400).json({ error: 'shardId is required' });
		}

		if (!this.shardService.removeShard(shardId)) {
			return res.status(404).json({ error: 'Shard not found' });
		}

		return res.sendStatus(204);
	}
}
