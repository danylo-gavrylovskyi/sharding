import crypto from 'crypto';

export class BloomFilter {
	private bitArray: Uint8Array;
	private size: number;
	private hashCount: number;

	constructor(size: number, hashCount: number) {
		this.size = size;
		this.hashCount = hashCount;
		this.bitArray = new Uint8Array(size);
	}

	add(key: string): void {
		for (let i = 0; i < this.hashCount; i++) {
			const index = this.hash(key, i);
			this.bitArray[index] = 1;
		}
	}

	has(key: string): boolean {
		for (let i = 0; i < this.hashCount; i++) {
			const index = this.hash(key, i);
			if (this.bitArray[index] === 0) return false;
		}

		return true;
	}

	private hash(key: string, seed: number): number {
		const hash = crypto.createHash('sha256');
		hash.update(key + seed);
		const digest = hash.digest();

		return ((digest.readUInt32BE(0) % this.size) + this.size) % this.size;
	}
}
