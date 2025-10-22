import { Request, Response } from 'express';
import { AddRecordDto } from '../dtos/addRecordDto';
import { TableService } from '../services/tableService';
import { ShardingKeys } from '../types/types';

export class TableController {
	constructor(private tableService: TableService) { }

	listTables(_: Request, res: Response) {
		const list = this.tableService.listTables();
		res.status(200).json({ tables: list });
	};

	createTable(req: Request, res: Response) {
		const { tableId, partitionKey, sortKey } = req.body;
		if (!tableId || !partitionKey) {
			return res.status(400).json({ error: 'tableId and partitionKey are required' });
		}

		if (!this.tableService.createTable(tableId, partitionKey, sortKey)) {
			return res.status(409).json({ error: 'Table with this ID already exists' });
		}

		return res.sendStatus(201);
	}

	async existsRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		if (!await this.tableService.existsRecord(tableId, partitionKey, sortKey)) {
			return res.status(404).json({ error: 'Record not found' });
		}

		return res.sendStatus(200);
	}

	async getRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey } = req.query as ShardingKeys;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey is required' });
		}

		const record = await this.tableService.getRecord(tableId, partitionKey, sortKey);
		if (!record) {
			return res.status(404).json({ error: 'Record not found' });
		}

		return res.status(200).json(record.data);
	}

	async addRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey, record }: AddRecordDto = req.body;

		if (!partitionKey) {
			return res.status(400).json({ error: 'partitionKey and record are required' });
		}

		if (!await this.tableService.addRecord(tableId, { partitionKey, sortKey, record })) {
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

		if (!await this.tableService.deleteRecord(tableId, partitionKey, sortKey)) {
			return res.status(500).json({ error: 'Failed to delete record' });
		}

		return res.sendStatus(204);
	}
}
