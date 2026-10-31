import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_UPI_ID = '7036923456@ybl';
const MERCHANT_NAME = 'ETHREE ENTERTAINMENT';

export default function UpiQrModal({
  visible,
  amount,
  txnId,
  mobile,
  onCancel,
  onPaymentSuccess,
  onPaymentFailure,
}) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [upiId, setUpiId] = useState(DEFAULT_UPI_ID);
  const [editingUpi, setEditingUpi] = useState(false);
  const [tempUpi, setTempUpi] = useState(DEFAULT_UPI_ID);
  const [imageLoading, setImageLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('merchant_upi_id').then((saved) => {
      if (saved) {
        setUpiId(saved);
        setTempUpi(saved);
      }
    });
  }, []);

  const saveCustomUpi = async () => {
    const trimmed = tempUpi.trim();
    if (trimmed && trimmed.includes('@')) {
      setUpiId(trimmed);
      await AsyncStorage.setItem('merchant_upi_id', trimmed);
    }
    setEditingUpi(false);
  };

  const formattedAmount = (Number(amount) || 0).toFixed(2);
  const note = `ETHREE-${txnId || Date.now().toString().slice(-6)}`;

  // NPCI Standard UPI Intent URI
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(
    txnId || ''
  )}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    upiIntentUri
  )}&margin=12&format=png`;

  const handleSuccess = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      onPaymentSuccess(txnId);
    }, 300);
  };

  const handleFailure = () => {
    if (onPaymentFailure) {
      onPaymentFailure(txnId);
    } else if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, isLandscape ? styles.cardLandscape : styles.cardPortrait]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleBox}>
                <View style={styles.upiBadge}>
                  <Text style={styles.upiBadgeText}>UPI QR</Text>
                </View>
                <Text style={styles.title}>Scan & Pay</Text>
              </View>
              <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Content Body */}
            <View style={[styles.bodyRow, isLandscape && { flexDirection: 'row', gap: 24 }]}>
              {/* Left Column: QR Code Box */}
              <View style={[styles.qrContainer, isLandscape && { flex: 1.1 }]}>
                <View style={styles.qrFrame}>
                  {imageLoading && (
                    <View style={styles.qrLoadingBox}>
                      <ActivityIndicator size="large" color="#0084c2" />
                      <Text style={styles.qrLoadingText}>Generating UPI QR...</Text>
                    </View>
                  )}
                  <Image
                    source={{ uri: qrImageUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                    onLoadEnd={() => setImageLoading(false)}
                  />
                </View>

                {/* UPI Apps Row */}
                <View style={styles.appsRow}>
                  <Text style={styles.supportedText}>
                    Google Pay • PhonePe • Paytm • BHIM • Any UPI
                  </Text>
                </View>
              </View>

              {/* Right Column: Payment Details & Manual Action Buttons */}
              <View style={[styles.infoContainer, isLandscape && { flex: 1.2 }]}>
                {/* Amount Pill */}
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>TOTAL PAYABLE</Text>
                  <Text style={styles.amountValue}>₹{formattedAmount}</Text>
                </View>

                {/* Transaction Metadata */}
                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>TXN ID</Text>
                    <Text style={styles.metaVal}>{txnId || 'ETH-PENDING'}</Text>
                  </View>
                  {mobile ? (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>CUSTOMER</Text>
                      <Text style={styles.metaVal}>+91 {mobile}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>MERCHANT VPA</Text>
                    {editingUpi ? (
                      <View style={styles.editVpaRow}>
                        <TextInput
                          style={styles.vpaInput}
                          value={tempUpi}
                          onChangeText={setTempUpi}
                          autoCapitalize="none"
                          placeholder="yourvpa@upi"
                        />
                        <TouchableOpacity style={styles.vpaSaveBtn} onPress={saveCustomUpi}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.vpaDisplayRow}
                        onPress={() => setEditingUpi(true)}
                      >
                        <Text style={styles.metaValVpa}>{upiId}</Text>
                        <Ionicons name="pencil" size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Manual Decision Notice */}
                <View style={styles.instructionBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#38bdf8" />
                  <Text style={styles.instructionText}>
                    Verify payment on your phone / soundbox, then tap the appropriate button below.
                  </Text>
                </View>

                {/* Manual Button 1: PAYMENT SUCCESSFUL (Prints ticket) */}
                <TouchableOpacity
                  style={[styles.successBtn, confirming && { opacity: 0.7 }]}
                  onPress={handleSuccess}
                  disabled={confirming}
                  activeOpacity={0.8}
                >
                  <View style={styles.successIconCircle}>
                    {confirming ? (
                      <ActivityIndicator size="small" color="#065f46" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#065f46" />
                    )}
                  </View>
                  <View style={styles.btnTextContainer}>
                    <Text style={styles.successBtnText}>PAYMENT SUCCESSFUL</Text>
                    <Text style={styles.successBtnSubtext}>Confirm received & print tickets</Text>
                  </View>
                </TouchableOpacity>

                {/* Manual Button 2: PAYMENT FAILED (Displays error screen, NO print) */}
                <TouchableOpacity
                  style={styles.failedBtn}
                  onPress={handleFailure}
                  disabled={confirming}
                  activeOpacity={0.8}
                >
                  <View style={styles.failedIconCircle}>
                    <Ionicons name="close" size={20} color="#991b1b" />
                  </View>
                  <View style={styles.btnTextContainer}>
                    <Text style={styles.failedBtnText}>PAYMENT FAILED</Text>
                    <Text style={styles.failedBtnSubtext}>Payment cancelled / failed (No print)</Text>
                  </View>
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>CANCEL & BACK TO CART</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardPortrait: {
    width: '95%',
    maxWidth: 440,
    maxHeight: '92%',
  },
  cardLandscape: {
    width: '90%',
    maxWidth: 820,
    maxHeight: '92%',
  },
  scrollContent: {
    padding: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upiBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  upiBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  bodyRow: {
    flexDirection: 'column',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrFrame: {
    width: 240,
    height: 240,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f0c05a',
    shadowColor: '#f0c05a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  qrLoadingBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderRadius: 16,
  },
  qrLoadingText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  appsRow: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  supportedText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  infoContainer: {
    justifyContent: 'space-between',
  },
  amountBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f0c05a',
  },
  metaBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
  },
  metaVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  metaValVpa: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  vpaDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editVpaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vpaInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    borderWidth: 1,
    borderColor: '#38bdf8',
    minWidth: 130,
  },
  vpaSaveBtn: {
    backgroundColor: '#0284c7',
    padding: 4,
    borderRadius: 6,
  },
  instructionBox: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  instructionText: {
    color: '#bae6fd',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
    lineHeight: 14,
  },
  successBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 8,
  },
  successIconCircle: {
    backgroundColor: '#a7f3d0',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  failedBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 10,
  },
  failedIconCircle: {
    backgroundColor: '#fecaca',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  btnTextContainer: {
    flex: 1,
  },
  successBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  successBtnSubtext: {
    color: '#d1fae5',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  failedBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  failedBtnSubtext: {
    color: '#fee2e2',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
