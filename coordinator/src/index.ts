import express from 'express';
import bodyParser from 'body-parser';
import { ShardService } from './services/shardService';
import { ShardController } from './controllers/shardController';
import { TableController } from './controllers/tableController';
import routes from './routes';
import { ConsistentHashRing } from './services/consistentHashingService';
import { TableService } from './services/tableService';

const app = express();
app.use(bodyParser.json());
app.use(routes);

const PORT = Number(process.env.PORT || 8080);
const REPLICAS_COUNT = Number(process.env.REPLICAS_COUNT || 3);

const consistentHashingService = new ConsistentHashRing(REPLICAS_COUNT);
const shardService = new ShardService(consistentHashingService);
const tableService = new TableService(consistentHashingService, shardService);

export const shardController = new ShardController(shardService);
export const tableController = new TableController(tableService);

app.listen(PORT, () => {
	console.log(`Coordinator service running on port ${PORT}`);
});
