export type ReplicaSet = {
	leader: string;
	followers: string[];
	replicationFactor?: number; // Total number of replicas (N)
	writeQuorum?: number; // Number of replicas that must ack writes (W)
	readQuorum?: number; // Number of replicas to query for reads (R)
};
