import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wolis',
  slug: 'wolis',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.wolis.app',
    infoPlist: {
      NSBluetoothAlwaysUsageDescription:
        'Wolis needs Bluetooth to communicate with the Sensor Box.',
      NSBluetoothPeripheralUsageDescription:
        'Wolis needs Bluetooth to communicate with the Sensor Box.',
    },
  },
  android: {
    package: 'com.wolis.app',
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
  },
  plugins: [
    'expo-dev-client',
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: false,
        modes: ['peripheral', 'central'],
        bluetoothAlwaysPermission:
          'Allow Wolis to connect to the Sensor Box via Bluetooth.',
      },
    ],
  ],
});
