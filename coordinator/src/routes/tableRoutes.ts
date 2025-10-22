import { Router } from 'express';
import { TableController } from '../controllers/tableController';

export const createTableRoutes = (tableController: TableController) => {
	const router = Router();

	router.get('/tables', (req, res) => tableController.listTables(req, res));
	router.post('/tables', (req, res) => tableController.createTable(req, res));

	router.head('/tables/:tableId/records', (req, res) => tableController.existsRecord(req, res));
	router.get('/tables/:tableId/records', (req, res) => tableController.getRecord(req, res));
	router.post('/tables/:tableId/records', (req, res) => tableController.addRecord(req, res));
	router.delete('/tables/:tableId/records', (req, res) => tableController.deleteRecord(req, res));

	return router;
};
