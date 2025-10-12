import { Router } from 'express';
import { shardController } from 'src';

const router = Router();

router.get('/shards', shardController.listShards);
router.post('/shards', shardController.addShard);
router.delete('/shards/:shardId', shardController.removeShard);

export default router;
