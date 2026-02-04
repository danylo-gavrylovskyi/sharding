import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

import { OpenTelemetryTracingService } from './services/tracing/openTelemetryTracingService';
new OpenTelemetryTracingService();

import { ShardService } from './services/shardService';
import { ShardController } from './controllers/shardController';
import { TableController } from './controllers/tableController';
import { ConsistentHashRing } from './services/consistentHashingService';
import { TableService } from './services/tableService';
import { createRoutes } from './routes';
import { MetricsService } from './services/metricService';
import { createMetricMiddleware } from './middlewares/metricMiddleware';
import { PinoLoggingService } from './services/logging/pinoLoggingService';
import { MigrationService } from './services/migrationService';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8080);
const REPLICAS_COUNT = Number(process.env.REPLICAS_COUNT || 3);

const metricService = new MetricsService('coordinator');
const loggingService = new PinoLoggingService();
const consistentHashingService = new ConsistentHashRing(REPLICAS_COUNT);
const shardService = new ShardService(consistentHashingService, loggingService, metricService);
const migrationService = new MigrationService(shardService, loggingService)
const tableService = new TableService(consistentHashingService, shardService, migrationService, loggingService, metricService);

shardService.on('topology-change', (oldRing, newRing) => {
	const tableIds = Array.from(tableService.listTables()).map(t => t.id);
	migrationService.startMigration(oldRing, newRing, tableIds);
})

export const shardController = new ShardController(shardService);
export const tableController = new TableController(tableService);

const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(createMetricMiddleware(metricService));
app.use(createRoutes(shardController, tableController, metricService));

app.listen(PORT, () => {
	console.log(`Coordinator service running on port ${PORT}`);
});
