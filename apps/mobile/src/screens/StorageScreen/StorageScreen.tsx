import React from 'react';
import { Linking } from 'react-native';
import UnavailableScreen from '../../components/UnavailableScreen';
export const StorageScreen = () => <UnavailableScreen title="App storage" message="View actual storage usage and manage cached files in your device's app settings." action="Open app settings" onAction={() => { void Linking.openSettings(); }} />;
export default StorageScreen;
