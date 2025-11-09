import { ReplicationOperation } from './replicationOperation.enum';

export type ReplicationMessage = {
	logIndex: number;
	version: number;
	timestamp: number;
	operation: ReplicationOperation;
	tableId: string;
	partitionKey: string;
	sortKey?: string;
	record?: Record<string, any>;
};
