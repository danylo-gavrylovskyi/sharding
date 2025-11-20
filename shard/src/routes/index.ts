import { Router } from 'express';
import { RecordController } from '../controllers/recordController';
import { createRecordRoutes } from './recordRoutes';
import { createMetricRoutes } from './metricRoutes';
import { MetricsService } from 'src/services/metricService';

export const createRoutes = (recordController: RecordController, metricService: MetricsService) => {
	const api = Router()
		.use(createRecordRoutes(recordController))
		.use(createMetricRoutes(metricService));

	return Router().use('/internal', api);
};
