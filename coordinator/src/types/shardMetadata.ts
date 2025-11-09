import { ShardRole } from './shardRole';

export type ShardMetadata = {
	shardId: string;
	address: string;
	role: ShardRole;
};
