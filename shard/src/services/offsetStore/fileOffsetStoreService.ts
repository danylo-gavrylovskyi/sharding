import fs from 'fs';
import { OffsetStoreService } from './offsetStoreService.interface';
import { LoggingService } from '../logging/loggingService.interface';

export class FileOffsetStoreService implements OffsetStoreService {
	constructor(
		private loggingService: LoggingService,
		private filePath = './data/offset.txt'
	) { }

	load(): number {
		try {
			if (fs.existsSync(this.filePath)) {
				return Number(fs.readFileSync(this.filePath, 'utf8'));
			}
		} catch (error) {
			this.loggingService.warn('Failed to read offset from file:', error);
		}

		return -1;
	}

	save(offset: number): void {
		try {
			fs.writeFileSync(this.filePath, offset.toString(), 'utf-8');
		} catch (error) {
			this.loggingService.error('Failed to write offset to file:', error);
		}
	}
}
