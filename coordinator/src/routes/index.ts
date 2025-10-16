import { Router } from 'express';
import { createShardRoutes } from './shardRoutes';
import { createTableRoutes } from './tableRoutes';
import { ShardController } from '../controllers/shardController';
import { TableController } from '../controllers/tableController';

export const createRoutes = (
	shardController: ShardController,
	tableController: TableController
) => {
	const api = Router()
		.use(createShardRoutes(shardController))
		.use(createTableRoutes(tableController));

	return Router().use('/api', api);
};
