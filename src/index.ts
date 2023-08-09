import { App } from 'aws-cdk-lib';
import { OdrConsole } from './console.js';
import { OdrDatasets } from './dataset.js';

const app = new App();

const env = { region: 'ap-southeast-2' };

new OdrConsole(app, 'Console', { env });
new OdrDatasets(app, 'Datasets', { env, datasets: ['nz-imagery', 'nz-elevation'], logBucketName: 'linz-odr-logs' });
