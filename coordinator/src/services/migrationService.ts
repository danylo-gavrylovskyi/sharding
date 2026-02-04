import axios from "axios";
import { ConsistentHashRing } from "./consistentHashingService";
import { LoggingService } from "./logging/loggingService.interface";
import { ShardService } from "./shardService";

export class MigrationService {
    public isMigrating: Boolean = false;
    public oldRing: ConsistentHashRing | null = null;

    constructor(private shardService: ShardService, private loggingService: LoggingService) { }

    async startMigration(oldRing: ConsistentHashRing, newRing: ConsistentHashRing, tableIds: string[]) {
        if (this.isMigrating) {
            this.loggingService.warn('Migration already in progress, skipping trigger.');
            return;
        }

        this.isMigrating = true;
        this.oldRing = oldRing;

        this.loggingService.info('🔄 Topology change detected. Starting background migration...');

        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(5000);

        this.processMigration(newRing, tableIds).then(() => {
            this.isMigrating = false;
            this.oldRing = null;
            this.loggingService.info('✅ Migration completed.');
        }).catch((error: Error) => {
            this.loggingService.error(`Migration failed: ${error}`);
            this.isMigrating = false;
        })
    }

    private async processMigration(newRing: ConsistentHashRing, tableIds: string[]) {
        const shards = this.shardService.listShards();

        for (const tableId of tableIds) {
            for (const shard of shards) {
                try {
                    const { data } = await axios.get(`${shard.address}/internal/tables/${tableId}/partitions`);
                    const keys = data.partitionKeys;

                    for (const key of keys) {
                        await this.migrateKeyIfNeeded(key, tableId, newRing);
                    }
                } catch (error) {
                    this.loggingService.error(`Failed to fetch partitions from shard ${shard.address} for table ${tableId}: ${error}`);
                }
            }
        }
    }

    private async migrateKeyIfNeeded(partitionKey: string, tableId: string, newRing: ConsistentHashRing) {
        if (!this.oldRing) return;

        const oldShardId = this.oldRing.getServer(`${tableId}::${partitionKey}`);
        const newShardId = newRing.getServer(`${tableId}::${partitionKey}`);

        if (oldShardId && newShardId && oldShardId !== newShardId) {
            const oldAddress = this.shardService.getReplicaSet(oldShardId)?.leader;
            const newAddress = this.shardService.getReplicaSet(newShardId)?.leader;

            if (!oldAddress || !newAddress) return;

            this.loggingService.info(`Migrating key=${partitionKey} from ${oldShardId} to ${newShardId}`);

            try {
                const { data: records } = await axios.get<Record<string, any>[] | null>(`${oldAddress}/internal/tables/${tableId}/records`, { params: { partitionKey } });
                if (!records) return;

                for (const record of records) {
                    await axios.post(`${newAddress}/internal/tables/${tableId}/records`,
                        { ...record }
                    );
                }

                await axios.delete(`${oldAddress}/internal/tables/${tableId}/records`, { params: { partitionKey } });
            } catch (error) {
                this.loggingService.error(`Failed to migrate key ${partitionKey}: ${error}`);
            }
        }
    }
}
