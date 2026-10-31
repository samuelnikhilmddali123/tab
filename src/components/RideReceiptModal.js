import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Ride Receipt & Confirmation Modal Screen
 * Displays complete transaction receipt details after Easebuzz payment verification.
 */
export default function RideReceiptModal({
  visible,
  receipt,
  onDone,
  onReprint,
  isPrinting = false,
  btStatus = 'disconnected',
}) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!receipt) return null;

  const items = receipt.items || [];
  const totalAmount = Number(receipt.amount || 0).toFixed(2);
  const txnId = receipt.id || receipt.txnid || 'N/A';
  const paymentMode = receipt.paymentMode || 'Easebuzz Live (UPI/Cards)';
  const dateStr = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={styles.overlay}>
        <View style={[styles.container, isLandscape ? styles.landscapeContainer : styles.portraitContainer]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <Ionicons name="checkmark-sharp" size={32} color="#ffffff" />
              </View>
            </View>
            <View style={styles.headerTextCol}>
              <View style={styles.badgeRow}>
                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>✓ PAYMENT VERIFIED & PAID</Text>
                </View>
                <View style={styles.gatewayBadge}>
                  <Text style={styles.gatewayBadgeText}>EASEBUZZ LIVE</Text>
                </View>
              </View>
              <Text style={styles.headerTitle}>Ride Receipt & Confirmation</Text>
              <Text style={styles.headerSubtitle}>Booking confirmed in backend database</Text>
            </View>
            <TouchableOpacity onPress={onDone} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Receipt Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
            {/* Amount Banner */}
            <View style={styles.amountBanner}>
              <View>
                <Text style={styles.amountBannerLabel}>TOTAL FARE PAID</Text>
                <Text style={styles.amountBannerVal}>₹{totalAmount}</Text>
              </View>
              <View style={styles.statusBox}>
                <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                <Text style={styles.statusBoxText}>SYNCED</Text>
              </View>
            </View>

            {/* Ride Items Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RIDE BREAKDOWN</Text>
              <View style={styles.tableCard}>
                {items.length === 0 ? (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableItemName}>Ride Fare Ticket</Text>
                    <Text style={styles.tableItemTotal}>₹{totalAmount}</Text>
                  </View>
                ) : (
                  items.map((item, idx) => (
                    <View
                      key={item.cartId || idx}
                      style={[
                        styles.tableRow,
                        idx < items.length - 1 && styles.tableRowBorder,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tableItemName}>{item.name}</Text>
                        <Text style={styles.tableItemSub}>
                          ₹{item.price} × {item.quantity || 1}
                        </Text>
                      </View>
                      <Text style={styles.tableItemTotal}>
                        ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Transaction Metadata */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TRANSACTION DETAILS</Text>
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Transaction ID</Text>
                  <Text style={styles.metaValMono}>{txnId}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment Gateway</Text>
                  <Text style={styles.metaValHighlight}>Easebuzz Production</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment Mode</Text>
                  <Text style={styles.metaVal}>{paymentMode}</Text>
                </View>
                {receipt.mobile ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Passenger Mobile</Text>
                    <Text style={styles.metaVal}>+91 {receipt.mobile}</Text>
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date & Time</Text>
                  <Text style={styles.metaVal}>{dateStr}</Text>
                </View>
                <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.metaLabel}>Ride Status</Text>
                  <Text style={[styles.metaVal, { color: '#10b981', fontWeight: '900' }]}>
                    CONFIRMED (PAID)
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            {onReprint && (
              <TouchableOpacity
                style={[styles.reprintBtn, isPrinting && { opacity: 0.6 }]}
                onPress={() => onReprint(receipt)}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="print-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.reprintBtnText}>
                  {isPrinting ? 'PRINTING TICKET...' : 'REPRINT TICKET'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#0f172a" style={{ marginRight: 8 }} />
              <Text style={styles.doneBtnText}>NEW RIDE BOOKING</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: '90%',
  },
  portraitContainer: {
    width: '100%',
    maxWidth: 520,
  },
  landscapeContainer: {
    width: '75%',
    maxWidth: 700,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0b1120',
  },
  successIconOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  successIconInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  paidBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  paidBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gatewayBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gatewayBadgeText: {
    color: '#f0c05a',
    fontSize: 9,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 20,
  },
  amountBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  amountBannerLabel: {
    fontSize: 10,
    color: '#f0c05a',
    fontWeight: '900',
    letterSpacing: 1,
  },
  amountBannerVal: {
    fontSize: 30,
    color: '#ffffff',
    fontWeight: '900',
    marginTop: 2,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  statusBoxText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '900',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableItemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  tableItemSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  tableItemTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  metaCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#283548',
  },
  metaLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 12,
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  metaValMono: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  metaValHighlight: {
    fontSize: 12,
    color: '#f0c05a',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0b1120',
  },
  reprintBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reprintBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  doneBtn: {
    flex: 1.3,
    backgroundColor: '#f0c05a',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

