import { Router } from 'express';
import { ShardController } from '../controllers/shardController';

export const createShardRoutes = (shardController: ShardController) => {
	const router = Router();

	router.get('/shards', shardController.listShards);
	router.post('/shards', shardController.addShard);
	router.delete('/shards/:shardId', shardController.removeShard);

	return router;
};
