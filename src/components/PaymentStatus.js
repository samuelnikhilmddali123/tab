import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentStatus({ 
  visible, 
  status, 
  title,
  subTitle,
  desc,
  onRetry, 
  onCancel, 
  onDone, 
  onConfirmCounterUPI,
  retryText = 'RETRY UPI PAYMENT',
  cancelText = 'BACK TO ORDER CART'
}) {
  const { width } = useWindowDimensions();
  const isLandscape = width > 600;

  const config = {
    awaiting: {
      title: title || 'AWAITING PAYMENT',
      sub: subTitle || 'A secure payment window has opened.',
      desc: desc || 'Ask the customer to complete the transaction on their device.',
      statusLabel: 'TRANSACTION STATUS',
      statusVal: 'Scanning for Success...',
      icon: 'sync-outline',
      color: '#3b82f6',
      bg: '#1e293b',
    },
    success: {
      title: title || 'PAYMENT SUCCESSFUL',
      sub: subTitle || 'The transaction was completed successfully.',
      desc: desc || 'You can now hand over the printed tickets to the customer.',
      statusLabel: 'TRANSACTION ID',
      statusVal: 'PAYMENT VERIFIED',
      icon: 'checkmark-circle',
      color: '#10b981',
      bg: '#064e3b',
    },
    error: {
      title: title || 'PAYMENT FAILED',
      sub: subTitle || 'TRANSACTION WAS NOT COMPLETED',
      desc: desc || 'The payment was marked as failed or cancelled. No tickets were printed.',
      statusLabel: 'PAYMENT STATUS',
      statusVal: 'Payment Incomplete / Cancelled',
      icon: 'close-circle',
      color: '#ef4444',
      bg: '#450a0a',
    }
  };

  const current = config[status] || config.awaiting;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { width: isLandscape ? 450 : '90%' }]}>
          <View style={[styles.iconCircle, { backgroundColor: current.bg }]}>
            <Ionicons name={current.icon} size={60} color={current.color} />
          </View>
          
          <Text style={[styles.title, { color: current.color === '#3b82f6' ? '#fff' : current.color }]}>{current.title}</Text>
          <Text style={styles.sub}>{current.sub}</Text>
          <Text style={styles.desc}>{current.desc}</Text>

          <View style={styles.detailBox}>
            <View style={[styles.smallIcon, { backgroundColor: current.bg }]}>
                <Ionicons name={status === 'success' ? "receipt" : "alert-circle"} size={24} color={current.color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>{current.statusLabel}</Text>
                <Text style={styles.statusVal}>{current.statusVal}</Text>
            </View>
          </View>

          {status === 'error' && onConfirmCounterUPI && (
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#10b981', marginBottom: 12 }]} onPress={onConfirmCounterUPI}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{marginRight: 10}} />
                <Text style={styles.btnText}>CONFIRM COUNTER UPI & PRINT</Text>
            </TouchableOpacity>
          )}

          {status === 'error' && onRetry && (
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                <Ionicons name="refresh" size={20} color="#fff" style={{marginRight: 10}} />
                <Text style={styles.btnText}>{retryText}</Text>
            </TouchableOpacity>
          )}

          {(status === 'error' || status === 'awaiting') && onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Ionicons name="cart-outline" size={20} color="#94a3b8" style={{marginRight: 10}} />
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </TouchableOpacity>
          )}

          {status === 'success' && onDone && (
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#10b981' }]} onPress={onDone}>
                <Text style={styles.btnText}>DONE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 32, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#334155', elevation: 10 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 8, textAlign: 'center', letterSpacing: 0.5 },
  sub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', fontWeight: 'bold', marginBottom: 12, paddingHorizontal: 15 },
  desc: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  detailBox: { backgroundColor: '#0f172a', width: '100%', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  smallIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  statusLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', letterSpacing: 0.5 },
  statusVal: { fontSize: 15, color: '#fff', fontWeight: 'bold', marginTop: 2 },
  retryBtn: { backgroundColor: '#e11d48', width: '100%', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  cancelBtn: { width: '100%', padding: 15, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderColor: '#334155', borderWidth: 1, backgroundColor: '#0f172a' },
  cancelBtnText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 },
});
