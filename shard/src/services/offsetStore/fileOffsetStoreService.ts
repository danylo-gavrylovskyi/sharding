import fs from 'fs';
import { OffsetStoreService } from './offsetStoreService.interface';

export class FileOffsetStoreService implements OffsetStoreService {
	constructor(private filePath = './data/offset.txt') {}

	load(): number {
		try {
			if (fs.existsSync(this.filePath)) {
				return Number(fs.readFileSync(this.filePath, 'utf8'));
			}
		} catch (error) {
			console.warn('Failed to read offset file:', error);
		}

		return -1;
	}

	save(offset: number): void {
		try {
			fs.writeFileSync(this.filePath, offset.toString(), 'utf-8');
		} catch (error) {
			console.warn('Failed to write offset to file:', error);
		}
	}
}
