import { Request, Response } from 'express';
import { AddRecordDto } from 'src/dtos/addRecordDto';
import { TableService } from 'src/services/tableService';

export class TableController {
	constructor(private tableService: TableService) {}

	listTables(_: Request, res: Response) {
		const list = this.tableService.listTables();
		res.json({ tables: list });
	}

	createTable(req: Request, res: Response) {
		const { tableId, partitionKey, sortKey } = req.body;
		if (!tableId || !partitionKey) {
			return res.status(400).json({ error: 'tableId and partitionKey are required' });
		}

		if (!this.tableService.createTable(tableId, partitionKey, sortKey)) {
			return res.status(409).json({ error: 'Table with this ID already exists' });
		}

		return res.status(201);
	}

	existsRecord(req: Request, res: Response) {}

	getRecord(req: Request, res: Response) {}

	addRecord(req: Request, res: Response) {
		const tableId = req.params.tableId;
		const { partitionKey, sortKey, record }: AddRecordDto = req.body;

		if (!partitionKey) {
			return res.status(400).json({ error: 'tableId and record are required' });
		}

		// take the shard for record
		// add record to that shard
	}

	deleteRecord(req: Request, res: Response) {}
}
