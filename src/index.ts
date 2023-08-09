import { App } from 'aws-cdk-lib';
import { LinzOdr } from './stack';

const app = new App();

new LinzOdr(app, 'OpenData', { env: { region: 'ap-southeast-2' } });
