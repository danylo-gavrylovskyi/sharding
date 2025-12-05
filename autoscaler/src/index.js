const { AutoScalerService } = require('./autoScalerService');

const prometheusUrl = process.env.PROM_URL || 'http://prometheus:9090';

const autoscaler = new AutoScalerService(prometheusUrl);

autoscaler.start();

console.log('Autoscaler is running...');
