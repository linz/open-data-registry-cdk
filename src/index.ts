import { App } from 'aws-cdk-lib';
import { OdrDataset } from './dataset.js';
import { OdrConsole } from './console.js';

const app = new App();

const env = { region: 'ap-southeast-2' };

new OdrConsole(app, 'Console', { env });
new OdrDataset(app, 'Imagery', { env, datasetName: 'nz-imagery' });
