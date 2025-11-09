import { ShardRole } from './shardRole.enum';

export type ShardMetadata = {
	shardId: string;
	address: string;
	role: ShardRole;
};
