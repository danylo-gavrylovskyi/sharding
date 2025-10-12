type TableDef = {
	partitionKey: string;
	sortKey?: string;
};

type ShardInfo = {
	address: string;
};

export { TableDef, ShardInfo };
