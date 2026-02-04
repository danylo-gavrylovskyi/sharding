import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/metricService';

export const createMetricMiddleware = (metrics: MetricsService) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const end = metrics.httpRequestHistogram.startTimer({
			route: req.path,
			method: req.method,
		});

		metrics.httpThroughputCounter.inc({ route: req.path, method: req.method });

		const originalError = res.status;

		let isError = false;
		res.status = function (code: number) {
			if (code >= 400) {
				isError = true;
			}
			return originalError.call(this, code);
		};

		res.on('finish', () => {
			end();
			if (isError) {
				metrics.httpErrorCounter.inc({ route: req.path, method: req.method });
			}
		});

		next();
	};
};
