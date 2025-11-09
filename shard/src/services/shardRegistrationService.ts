import axios from 'axios';
import { ShardMetadata } from 'src/types/shardMetadata.type';

export class ShardRegistrationService {
	constructor(
		private coordinatorUrl: string,
		private shardInfo: ShardMetadata,
		private maxRetries = 5,
		private delayMs = 1000
	) {}

	async register(): Promise<void> {
		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				console.log(`Attempting registration: ${this.coordinatorUrl}`, this.shardInfo);
				await axios.post(this.coordinatorUrl, this.shardInfo, { timeout: 10000 });
				console.log('Shard registered');

				return;
			} catch (error) {
				console.error(`Attempt ${attempt + 1} failed:`, error.message || error);

				const delay = this.delayMs * 2 ** attempt;
				await new Promise((res) => setTimeout(res, delay));
			}
		}

		console.log('Failed to register shard after maximum retries');
	}
}
