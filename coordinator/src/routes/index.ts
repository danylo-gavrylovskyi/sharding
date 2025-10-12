import { Router } from 'express';
import shardRoutes from './shardRoutes';
import tableRoutes from './tableRoutes';

const api = Router().use(shardRoutes).use(tableRoutes);

export default Router().use('/api', api);
