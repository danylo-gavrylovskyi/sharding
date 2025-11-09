export interface MessageSubscriber {
	subscribe(handler: (message: any) => void): Promise<void>;
}
