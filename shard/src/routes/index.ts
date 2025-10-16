import { Router } from 'express';
import { RecordController } from '../controllers/recordController';
import { createRecordRoutes } from './recordRoutes';

export const createRoutes = (recordController: RecordController) => {
	const api = Router().use(createRecordRoutes(recordController));
	return Router().use('/internal', api);
};
