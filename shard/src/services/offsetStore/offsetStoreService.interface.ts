export interface OffsetStoreService {
	load(): number;
	save(offset: number): void;
}
