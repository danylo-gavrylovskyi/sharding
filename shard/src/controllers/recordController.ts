import { Request, Response } from 'express';
import { RecordService } from 'src/services/recordService';
import { ShardingKeys } from 'src/types/shardingKeys.type';

export class RecordController {
	constructor(private recordService: RecordService) { }

	getTablePartitionKeys(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const partitionKeys = this.recordService.getTablePartitionKeys(tableId);
		return res.status(200).json({ partitionKeys });
	}

	existsRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		if (!this.recordService.existsRecord(tableId, partitionKey, sortKey)) {
			return res.status(404).json({ error: 'Record not found' });
		}

		return res.sendStatus(200);
	}

	getRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		const record = this.recordService.getRecord(tableId, partitionKey, sortKey);
		if (!record) {
			return res.status(404).json({ error: 'Record not found' });
		}

		return res.status(200).json(record);
	}

	async addRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const dto = req.body;

		if (!dto.partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		if (!(await this.recordService.addRecord(tableId, dto))) {
			return res.status(500).json({ error: 'Failed to add record' });
		}

		return res.sendStatus(201);
	}

	async deleteRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		if (!(await this.recordService.deleteRecord(tableId, partitionKey, sortKey))) {
			return res.status(500).json({ error: 'Failed to delete record' });
		}

		return res.sendStatus(204);
	}
}
