import { Router } from 'express';
import { TableController } from '../controllers/tableController';

export const createTableRoutes = (tableController: TableController) => {
	const router = Router();

	router.get('/tables', tableController.listTables);
	router.post('/tables', tableController.createTable);

	router.head('/tables/:tableId/records', tableController.existsRecord);
	router.get('/tables/:tableId/records', tableController.getRecord);
	router.post('/tables/:tableId/records', tableController.addRecord);
	router.delete('/tables/:tableId/records', tableController.deleteRecord);

	return router;
};
