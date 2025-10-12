import { Router } from 'express';
import { tableController } from 'src';

const router = Router();

router.get('/tables', tableController.listTables);
router.post('/tables', tableController.createTable);

router.post('/tables/:tableId/records', tableController.addRecord);
router.get('/tables/:tableId/records/:recordKey', tableController.getRecord);
router.delete('/tables/:tableId/records/:recordKey', tableController.deleteRecord);
router.head('/tables/:tableId/records/:recordKey', tableController.existsRecord);

export default router;
