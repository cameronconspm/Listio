import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { reportAppError } from '../utils/logger';

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Release builds hide the redbox; uncaught render errors become a white screen.
 * Show a minimal fallback so TestFlight users (and we) see that JS failed.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportAppError(error, { componentStack: info.componentStack });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.screen} accessibilityRole="alert">
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              Please force-quit the app and open it again. If this keeps happening, contact support.
            </Text>
            {__DEV__ ? (
              <Text style={styles.detail} selectable>
                {this.state.error.message}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f2f7' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', color: '#1c1c1e', marginBottom: 12 },
  body: { fontSize: 16, color: '#3a3a3c', lineHeight: 22 },
  detail: { marginTop: 16, fontSize: 13, color: '#636366', fontFamily: 'Menlo' },
});
