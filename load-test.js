import http from 'k6/http';

export const options = {
    stages: [
        {duration: '10s', target: 10000},
        {duration: '1m', target: 10000},
        {duration: '10s', target: 0},
    ],
};

export function setup() {
    const payload = JSON.stringify({
        tableId: 'loadtest',
        partitionKey: 'pk',
        sortKey: 'sk',
    });

    const params = {headers: {'Content-Type': 'application/json'}};

    http.post('http://localhost:8080/api/tables', payload, params);
}

export default function () {
    const url = 'http://localhost:8080/api/tables/loadtest/records';

    const partitionKey = `user-${Math.floor(Math.random() * 1000)}`;

    const payload = JSON.stringify({
        partitionKey: partitionKey,
        record: {value: 'some-data'},
        sortKey: '1',
    });

    const params = {
        headers: {'Content-Type': 'application/json'},
    };

    http.post(url, payload, params);
}
