export interface MessagePublisher {
	publish(message: any): Promise<void>;
}
