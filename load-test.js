import http from 'k6/http';

export const options = {
    vus: 30,
    duration: '2m',
};

const heavyData = 'x'.repeat(10000);

export function setup() {
    const payload = JSON.stringify({
        tableId: 'loadtest',
        partitionKey: 'pk',
        sortKey: 'sk',
    });
    const params = {headers: {'Content-Type': 'application/json'}};
    try {
        http.post('http://localhost:8080/api/tables', payload, params);
    } catch (e) {}
}

export default function () {
    const url = 'http://localhost:8080/api/tables/loadtest/records';

    const partitionKey = `user-${Math.floor(Math.random() * 100000)}`;

    const payload = JSON.stringify({
        partitionKey: partitionKey,
        record: {
            value: heavyData,
            metadata: 'Make the CPU work to parse this',
            timestamp: Date.now(),
        },
        sortKey: '1',
    });

    const params = {
        headers: {'Content-Type': 'application/json'},
    };

    http.post(url, payload, params);
}
