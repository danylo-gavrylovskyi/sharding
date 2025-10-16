import { Router } from 'express';
import { RecordController } from '../controllers/recordController';

export const createRecordRoutes = (recordController: RecordController) => {
	const router = Router();

	router.head('/tables/:tableId/records', recordController.existsRecord);
	router.get('/tables/:tableId/records', recordController.getRecord);
	router.post('/tables/:tableId/records', recordController.addRecord);
	router.delete('/tables/:tableId/records', recordController.deleteRecord);

	return router;
};
