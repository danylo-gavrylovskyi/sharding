import os from 'os';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/metricService';

export const createMetricMiddleware = (metrics: MetricsService) => {
	const instance = process.env.SHARD_NAME || os.hostname();

	return (req: Request, res: Response, next: NextFunction) => {
		const end = metrics.httpRequestHistogram.startTimer({
			route: req.path,
			method: req.method,
			instance: instance,
		});

		metrics.httpThroughputCounter.inc({
			route: req.path,
			method: req.method,
			instance: instance,
		});

		const originalStatus = res.status;

		let isError = false;
		res.status = function (code: number) {
			if (code >= 400) {
				isError = true;
			}
			return originalStatus.call(this, code);
		};

		res.on('finish', () => {
			end();
			if (isError) {
				metrics.httpErrorCounter.inc({
					route: req.path,
					method: req.method,
					instance: instance,
				});
			}
		});

		next();
	};
};
