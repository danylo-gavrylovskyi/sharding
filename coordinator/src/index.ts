import express from 'express';
import bodyParser from 'body-parser';
import { ConsistentHashRing } from './consistentHashRing';
import { ShardService } from './services/shardService';
import { ShardController } from './controllers/shardController';
import { TableController } from './controllers/tableController';
import routes from './routes';

const app = express();
app.use(bodyParser.json());
app.use(routes);

const PORT = Number(process.env.PORT || 8080);
const REPLICAS_COUNT = Number(process.env.REPLICAS_COUNT || 3);

export const hashRing = new ConsistentHashRing(REPLICAS_COUNT);

const shardService = new ShardService(hashRing);
export const shardController = new ShardController(shardService);
export const tableController = new TableController(shardService);

app.listen(PORT, () => {
	console.log(`Coordinator service running on port ${PORT}`);
});
