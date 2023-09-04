import { App } from 'aws-cdk-lib';
import { OdrConsole } from './console.js';
import { OdrDatasets } from './dataset.js';

const app = new App();

const env = { region: 'ap-southeast-2', account: '838278294040' };
const datasets = ['nz-imagery'];
const logBucketName = 'linz-odr-access-logs';

new OdrConsole(app, 'Console', { env, description: 'Cross account AWS console access' });
new OdrDatasets(app, 'Datasets', {
  env,
  datasets,
  logBucketName,
  description: 'S3 Bucket and Access logs for datasets: ' + datasets.join(', '),
});
