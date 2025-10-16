export type AddRecordDto = {
	partitionKey: string;
	sortKey?: string;
	record: Record<string, any>;
};
