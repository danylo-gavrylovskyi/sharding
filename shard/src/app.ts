import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { BloomFilterService } from './services/bloomFilter/bloomFilterService';
import { RecordService } from './services/recordService';
import { RecordController } from './controllers/recordController';
import { createRoutes } from './routes';
import { ShardRegistrationService } from './services/shardRegistrationService';
import { ShardRole } from './types/shardRole.enum';
import { RabbitMQService } from './services/messageQueue/rabbitMQService';
import { ReplicationProducerService } from './services/replication/replicationProducerService';
import { ReplicationConsumerService } from './services/replication/replicationConsumerService';
import { FileOffsetStoreService } from './services/offsetStore/fileOffsetStoreService';
import { retry } from './utils/retry';
import { MetricsService } from './services/metricService';
import { createMetricMiddleware } from './middlewares/metricMiddleware';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8000);
const ADDRESS: string = process.env.ADDRESS || `http://localhost:${PORT}`;
const SHARD_ID: string = process.env.SHARD_ID || `shard-${PORT}`;
const COORDINATOR_URL: string = process.env.COORDINATOR_URL || 'http://localhost:8080/api/shards';
const ROLE: ShardRole = (process.env.ROLE as ShardRole) || ShardRole.FOLLOWER;
const RABBITMQ_URL: string = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME: string = process.env.EXCHANGE_NAME || 'replication';

const metricService = new MetricsService('coordinator');
const registrationService = new ShardRegistrationService(COORDINATOR_URL, {
	shardId: SHARD_ID,
	address: ADDRESS,
	role: ROLE,
});
const bloomFilterService = new BloomFilterService();
const offsetStoreService = new FileOffsetStoreService();
const rabbitMQService = new RabbitMQService(RABBITMQ_URL, EXCHANGE_NAME);

async function bootstrap() {
	await registrationService.register();
	await retry(async () => {
		await rabbitMQService.connect();
	});

	let recordService: RecordService;

	if (ROLE === ShardRole.LEADER) {
		const replicationProducerService = new ReplicationProducerService(rabbitMQService);
		recordService = new RecordService(bloomFilterService, ROLE, replicationProducerService);
	} else {
		recordService = new RecordService(bloomFilterService, ROLE);
		const replicationConsumerService = new ReplicationConsumerService(
			rabbitMQService,
			recordService,
			offsetStoreService
		);
		await replicationConsumerService.start();
	}

	const recordController = new RecordController(recordService);

	const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
	app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
	app.use(createMetricMiddleware(metricService));
	app.use(createRoutes(recordController, metricService));

	app.listen(PORT, () => {
		console.log(`Shard service running on port ${PORT}`);
		console.log(`Shard started as ${ROLE}.`);
	});
}

bootstrap().catch((error) => {
	console.error('Fatal error during bootstrap:', error);
	process.exit(1);
});
