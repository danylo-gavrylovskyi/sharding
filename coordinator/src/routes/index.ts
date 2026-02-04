import { Router } from 'express';
import { createShardRoutes } from './shardRoutes';
import { createTableRoutes } from './tableRoutes';
import { ShardController } from '../controllers/shardController';
import { TableController } from '../controllers/tableController';
import { createMetricRoutes } from './metricRoutes';
import { MetricsService } from 'src/services/metricService';

export const createRoutes = (
	shardController: ShardController,
	tableController: TableController,
	metricService: MetricsService
) => {
	const api = Router()
		.use(createShardRoutes(shardController))
		.use(createTableRoutes(tableController))
		.use(createMetricRoutes(metricService));

	return Router().use('/api', api);
};
