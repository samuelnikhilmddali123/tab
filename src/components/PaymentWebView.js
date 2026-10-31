import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Text, ActivityIndicator, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentWebView({ visible, url, html, onCancel, onSuccess, onFailure, onUpdateUpi }) {
  const handleNavigationStateChange = (navState) => {
    const { url: currentUrl } = navState;
    if (!currentUrl) return;
    
    // Check for success markers
    if (
      currentUrl.includes('status=success') || 
      currentUrl.includes('payment=success') || 
      currentUrl.includes('payment-success')
    ) {
      onSuccess();
    } 
    // Check for failure markers
    else if (
      currentUrl.includes('status=failure') || 
      currentUrl.includes('payment=failure') || 
      currentUrl.includes('payment-failure')
    ) {
      onFailure();
    }
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SUCCESS' || data.status === 'success') {
        onSuccess();
      } else if (data.type === 'FAILURE' || data.status === 'failure' || data.type === 'CANCEL') {
        onFailure();
      } else if (data.type === 'UPDATE_UPI' && onUpdateUpi) {
        onUpdateUpi(data.upiId);
      }
    } catch (e) {}
  };

  const source = html ? { html } : (url ? { uri: url } : null);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.title}>Secure Payment Gateway</Text>
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        
        {source ? (
          <WebView
            source={source}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleMessage}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              handleNavigationStateChange(nativeEvent);
            }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>Loading Payment Gateway...</Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.error}>
            <Text style={styles.errorText}>Error: Invalid Payment Gateway Session</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#1e293b',
    backgroundColor: '#0b1120'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 10, fontWeight: 'bold' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  errorText: { color: '#ef4444', fontWeight: 'bold' }
});
