export async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			console.warn(`Retry ${attempt}/${retries} failed:`, error);
			if (attempt === retries) throw error;
			await new Promise((res) => setTimeout(res, delayMs * attempt));
		}
	}

	throw new Error('Retry logic exhausted');
}
