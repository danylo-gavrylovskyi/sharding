import express from 'express';
import { BloomFilterService } from './services/bloomFilter/bloomFilterService';
import { RecordService } from './services/recordService';
import { RecordController } from './controllers/recordController';
import { createRoutes } from './routes';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8000);

const bloomFilterService = new BloomFilterService();
const recordService = new RecordService(bloomFilterService);
export const recordController = new RecordController(recordService);

app.use(createRoutes(recordController));

app.listen(PORT, () => {
	console.log(`Coordinator service running on port ${PORT}`);
});
