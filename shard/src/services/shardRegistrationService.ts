import axios from 'axios';
import { ShardMetadata } from 'src/types/shardMetadata.type';
import { LoggingService } from './logging/loggingService.interface';

export class ShardRegistrationService {
	constructor(
		private coordinatorUrl: string,
		private shardInfo: ShardMetadata,
		private loggingService: LoggingService,
		private maxRetries = 5,
		private delayMs = 1000,
	) { }

	async register(): Promise<void> {
		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				this.loggingService.info(`Registering shard (attempt ${attempt + 1})...`);
				await axios.post(this.coordinatorUrl, this.shardInfo, { timeout: 10000 });
				this.loggingService.info('Shard registered successfully');

				return;
			} catch (error) {
				this.loggingService.error(
					`Failed to register shard on attempt ${attempt + 1}: ${error}`
				);

				const delay = this.delayMs * 2 ** attempt;
				await new Promise((res) => setTimeout(res, delay));
			}
		}

		this.loggingService.error('Exceeded maximum shard registration attempts');
		throw new Error('Shard registration failed after maximum retries');
	}
}
