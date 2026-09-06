if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args);
}
if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = (handle) => clearTimeout(handle);
}

import {AppRegistry} from 'react-native';
import {Buffer} from 'buffer';
import App from './src/App';
import {name as appName} from './app.json';

global.Buffer = global.Buffer || Buffer;

AppRegistry.registerComponent(appName, () => App);
