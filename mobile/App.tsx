import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import WolisNavigator from './src/navigation/WolisNavigator';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, padding: 20, paddingTop: 60, backgroundColor: 'red' }}>
          <Text style={{ fontSize: 20, color: 'white', fontWeight: 'bold' }}>App Crashed!</Text>
          <ScrollView>
            <Text style={{ color: 'white', marginTop: 10 }}>{String(this.state.error)}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <WolisNavigator />
    </ErrorBoundary>
  );
}
