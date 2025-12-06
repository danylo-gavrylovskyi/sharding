import axios from 'axios';
import Docker from 'dockerode';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
const SCALING_GROUP = (process.env.SCALING_GROUP || 'shard4,shard5,shard6').split(',');

const LATENCY_THRESHOLD = 200; // ms
const CPU_THRESHOLD = 70; // %
const SCALE_DOWN_MINUTES = 1;

const docker = new Docker({socketPath: '/var/run/docker.sock'});
let lowLoadStartTime = null;
let isToggling = false;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function getP99Latency() {
    const query = `histogram_quantile(0.99, sum(rate(shard_request_latency_bucket[1m])) by (le))`;
    try {
        const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {params: {query}});
        const result = res.data.data.result;
        return result.length > 0 ? parseFloat(result[0].value[1]) * 1000 : 0;
    } catch (error) {
        console.error('Metrics Error:', error.message);
        return 0;
    }
}

async function getMaxCpu() {
    const query = `max(rate(container_cpu_usage_seconds_total{name=~"shard.*"}[1m])) * 100`;
    try {
        const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {params: {query}});
        const result = res.data.data.result;
        return result.length > 0 ? parseFloat(result[0].value[1]) : 0;
    } catch (e) {
        console.error('Metrics Error:', error.message);
        return 0;
    }
}

async function getGroupStatus() {
    let runningCount = 0;
    for (const name of SCALING_GROUP) {
        try {
            const c = docker.getContainer(name);
            const info = await c.inspect();
            if (info.State.Status === 'running') runningCount++;
        } catch (error) {}
    }

    if (runningCount === SCALING_GROUP.length) return 'running';
    if (runningCount === 0) return 'stopped';
    return 'mixed';
}

async function startGroup() {
    console.log(`🚀 Scaling UP: Starting ShardSet-2 (${SCALING_GROUP.join(', ')})...`);
    await Promise.all(
        SCALING_GROUP.map(async (name) => {
            try {
                const container = docker.getContainer(name);
                const info = await container.inspect();
                if (info.State.Status !== 'running') {
                    await container.start();
                    console.log(`   -> ${name} started.`);
                }
            } catch (error) {
                console.error(`Failed to start ${name}`, error.message);
            }
        }),
    );

    await sleep(10000);
}

async function stopGroup() {
    console.log(`🛑 Scaling DOWN: Stopping ShardSet-2 (${SCALING_GROUP.join(', ')})...`);

    const reversed = [...SCALING_GROUP].reverse();

    for (const name of reversed) {
        try {
            const container = docker.getContainer(name);
            const info = await container.inspect();
            if (info.State.Status === 'running') {
                await container.stop();
                console.log(`   -> ${name} stopped.`);
            }
        } catch (error) {
            console.error(`Failed to stop ${name}`, error.message);
        }
    }
}

async function tick() {
    if (isToggling) return;

    const latency = await getP99Latency();
    const cpu = await getMaxCpu();
    const status = await getGroupStatus();

    console.log(
        `[Monitor] Latency: ${latency.toFixed(0)}ms | CPU: ${cpu.toFixed(
            1,
        )}% | ShardSet-2: ${status}`,
    );

    if (latency > LATENCY_THRESHOLD || cpu > CPU_THRESHOLD) {
        lowLoadStartTime = null;

        if (status !== 'running') {
            isToggling = true;
            await startGroup();
            isToggling = false;
        }
    } else if (latency < LATENCY_THRESHOLD / 2 || cpu < CPU_THRESHOLD / 2) {
        if (!lowLoadStartTime) {
            console.log('   Timer started for Scale Down...');
            lowLoadStartTime = Date.now();
        } else {
            const elapsedMinutes = (Date.now() - lowLoadStartTime) / 1000 / 60;
            if (elapsedMinutes > SCALE_DOWN_MINUTES) {
                if (status !== 'stopped') {
                    isToggling = true;
                    await stopGroup();
                    isToggling = false;
                }
                lowLoadStartTime = null;
            }
        }
    } else {
        lowLoadStartTime = null;
    }
}

setInterval(tick, 5000);
console.log('Autoscaler for ShardSet-2 started.');
