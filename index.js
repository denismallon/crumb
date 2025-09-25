import { registerRootComponent } from 'expo';

// Switch between App and AppTest by changing the import
import App from './App';
// import App from './AppTest';  // Uncomment this line to use the test version

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
