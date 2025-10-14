export type TableDef = {
	partitionKey: string;
	sortKey?: string;
};

export type ShardInfo = {
	address: string;
};

export type ShardingKeys = {
	partitionKey: string;
	sortKey?: string;
}
