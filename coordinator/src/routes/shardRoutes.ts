import { Router } from 'express';
import { ShardController } from '../controllers/shardController';

export const createShardRoutes = (shardController: ShardController) => {
	const router = Router();

	router.get('/shards', (req, res) => shardController.listShards(req, res));
	router.post('/shards', (req, res) => shardController.addShard(req, res));
	router.delete('/shards/:shardId', (req, res) => shardController.removeShard(req, res));

	return router;
};
