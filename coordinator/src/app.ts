import express from 'express';
import { ShardService } from './services/shardService';
import { ShardController } from './controllers/shardController';
import { TableController } from './controllers/tableController';
import { ConsistentHashRing } from './services/consistentHashingService';
import { TableService } from './services/tableService';
import { createRoutes } from './routes';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8080);
const REPLICAS_COUNT = Number(process.env.REPLICAS_COUNT || 3);

const consistentHashingService = new ConsistentHashRing(REPLICAS_COUNT);
const shardService = new ShardService(consistentHashingService);
const tableService = new TableService(consistentHashingService, shardService);

export const shardController = new ShardController(shardService);
export const tableController = new TableController(tableService);

app.use(createRoutes(shardController, tableController));

app.listen(PORT, () => {
	console.log(`Coordinator service running on port ${PORT}`);
});
