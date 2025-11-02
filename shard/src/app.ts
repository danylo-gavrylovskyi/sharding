import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { BloomFilterService } from './services/bloomFilter/bloomFilterService';
import { RecordService } from './services/recordService';
import { RecordController } from './controllers/recordController';
import { createRoutes } from './routes';
import { ShardRegistrationService } from './services/shardRegistrationService';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8000);
const ADDRESS = process.env.ADDRESS || `http://localhost:${PORT}`
const COORDINATOR_URL = process.env.COORDINATOR_URL || 'http://localhost:8080/api/shards'

const registrationService = new ShardRegistrationService(COORDINATOR_URL, {
	shardId: `shard-${PORT}`,
	address: ADDRESS
})
const bloomFilterService = new BloomFilterService();
const recordService = new RecordService(bloomFilterService);
export const recordController = new RecordController(recordService);

const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(createRoutes(recordController));

registrationService.register().then(() => {
	app.listen(PORT, () => {
		console.log(`Shard service running on port ${PORT}`);
	});
})
