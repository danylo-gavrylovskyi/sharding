import crypto from 'crypto';

export class ConsistentHashRing {
    private replicasCount: number;
    private servers: Set<string> = new Set();
    private ring: Map<string, string> = new Map();
    private sortedKeys: string[] = [];

    constructor(replicasCount: number) {
        this.replicasCount = replicasCount;
    }

    addServer(serverId: string): void {
        this.servers.add(serverId);

        for (let i = 0; i < this.replicasCount; i++) {
            const serverHash = this.hash(`${serverId}-${i}`);
            this.ring.set(serverHash, serverId);

            const idx = this.binarySearch(this.sortedKeys, serverHash);
            this.sortedKeys.splice(idx, 0, serverHash);
        }
    }

    removeServer(serverId: string): void {
        this.servers.delete(serverId);

        for (let i = 0; i < this.replicasCount; i++) {
            const serverHash = this.hash(`${serverId}-${i}`);
            this.ring.delete(serverHash);

            const idx = this.sortedKeys.indexOf(serverHash);
            if (idx >= 0) this.sortedKeys.splice(idx, 1);
        }
    }

    getServer(key: string): string | null {
        if (this.sortedKeys.length === 0 || this.ring.size === 0) return null;

        const keyHash = this.hash(key);

        let idx = this.binarySearch(this.sortedKeys, keyHash);
        if (idx === this.sortedKeys.length) idx = 0;

        const serverHash = this.sortedKeys[idx];
        const serverId = this.ring.get(serverHash);

        return serverId ?? null;
    }

    listServers(): string[] {
        return Array.from(this.servers);
    }

    private binarySearch(array: string[], value: string): number {
        let low = 0;
        let high = array.length;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);

            if (array[mid] < value) low = mid + 1;
            else high = mid;
        }

        return low;
    }

    private hash(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }
}
