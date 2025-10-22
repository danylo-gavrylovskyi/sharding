import { Router } from 'express';
import { RecordController } from '../controllers/recordController';

export const createRecordRoutes = (recordController: RecordController) => {
	const router = Router();

	router.head('/tables/:tableId/records', (req, res) => recordController.existsRecord(req, res));
	router.get('/tables/:tableId/records', (req, res) => recordController.getRecord(req, res));
	router.post('/tables/:tableId/records', (req, res) => recordController.addRecord(req, res));
	router.delete('/tables/:tableId/records', (req, res) => recordController.deleteRecord(req, res));

	return router;
};
