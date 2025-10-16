import { Request, Response } from 'express';
import { AddRecordDto } from 'src/dtos/addRecordDto';
import { RecordService } from 'src/services/recordService';
import { ShardingKeys } from 'src/types/shardingKeys';

export class RecordController {
	constructor(private recordService: RecordService) {}

	existsRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		if (!this.recordService.existsRecord(tableId, partitionKey, sortKey)) {
			return res.status(404).json({ error: 'Record not found' });
		}

		return res.status(200);
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

		return res.status(200).json({ record });
	}

	addRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey, record }: AddRecordDto = req.body;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey and record are required' });
		}

		if (!this.recordService.addRecord(tableId, partitionKey, record, sortKey)) {
			return res.status(500).json({ error: 'Failed to add record' });
		}

		return res.status(201);
	}

	deleteRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		if (!this.recordService.deleteRecord(tableId, partitionKey, sortKey)) {
			return res.status(500).json({ error: 'Failed to delete record' });
		}

		return res.status(204);
	}
}
