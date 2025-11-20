import { Router } from 'express';
import { MetricsService } from 'src/services/metricService';

export const createMetricRoutes = (metricService: MetricsService) => {
	const router = Router();

	router.get('/metrics', async (_, res) => {
		res.setHeader('Content-Type', 'text/plain');
		res.send(await metricService.metrics());
	});

	return router;
};
