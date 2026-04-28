import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Image, Text, Animated, ScrollView, TouchableOpacity, Modal, FlatList, Platform, PermissionsAndroid, Alert, ActivityIndicator, useWindowDimensions, TextInput } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { BLEPrinter } from 'react-native-thermal-receipt-printer-image-qr';
import * as FileSystem from 'expo-file-system/legacy';

// Constants
const TARGET_PRINTER_NAME = 'Printer001-6D49';

// Image paths
const IMAGES = {
  train: require('./assets/public/train_files/TL train.jpg'),
  bus: require('./assets/public/train_files/e three bus ride.webp'),
  sunMoon: require('./assets/public/train_files/SUN @ MOON ride.webp'),
  stackvil: require('./assets/public/train_files/stackvil_logo.png'),
  // New generated images
  bouncy: require('./assets/public/rides/bouncy.png'),
  bumping: require('./assets/public/rides/bumping.png'),
  vr: require('./assets/public/rides/vr.png'),
  cricket: require('./assets/public/rides/cricket.png'),
  air_hockey: require('./assets/public/rides/air_hockey.png'),
  massage: require('./assets/public/rides/massage.png'),
  softplay: require('./assets/public/rides/softplay.png'),
  samba: require('./assets/public/rides/samba.png'),
  columbus: require('./assets/public/rides/columbus.png'),
  zip_bike: require('./assets/public/rides/zip_bike.png'),
  rope: require('./assets/public/rides/rope.png'),
  gun_shoot: require('./assets/public/rides/gun_shoot.png'),
  basketball: require('./assets/public/rides/basketball.png'),
  theatre: require('./assets/public/rides/theatre.png'),
  rocket: require('./assets/public/rides/rocket.png'),
  surfer: require('./assets/public/rides/surfer.png'),
};

const RIDES_DATA = [
  { id: 1, name: 'TL TRAIN', price: 50, image: IMAGES.train, desc: 'A classic train ride perfect for families and children. Enjoy a scenic tour around the park in our...' },
  { id: 2, name: 'ETHREE BUS', price: 100, image: IMAGES.bus, desc: 'Hop on the ETHREE Shuttle Bus for a fun and easy way to navigate the park.' },
  { id: 3, name: 'SUN @ MOON', price: 100, image: IMAGES.sunMoon, desc: 'A gentle and charming rotary ride that takes you on a celestial journey.' },
  { id: 4, name: 'BOUNCY', price: 100, image: IMAGES.bouncy, desc: 'High-energy inflatable fun!' },
  { id: 5, name: 'SAMBA BALLOON', price: 150, image: IMAGES.samba, desc: 'Soar high in colorful hot air balloons.' },
  { id: 6, name: 'M. COLUMBUS', price: 120, image: IMAGES.columbus, desc: 'Experience the thrill of the high seas on this swinging pirate ship.' },
  { id: 7, name: 'BUMPING CARS', price: 150, image: IMAGES.bumping, desc: 'Classic robot-themed driving fun.' },
  { id: 8, name: 'ZIP BIKE', price: 150, image: IMAGES.zip_bike, desc: 'Cycle through the air!' },
  { id: 9, name: 'ROPE COURSE', price: 150, image: IMAGES.rope, desc: 'Test your balance and agility.' },
  { id: 10, name: 'GUN SHOOT', price: 100, image: IMAGES.gun_shoot, desc: 'Test your aim and steady hand.' },
  { id: 11, name: 'BASKET BALL', price: 100, image: IMAGES.basketball, desc: 'Show off your hoop skills!' },
  { id: 12, name: '2D THEATRE', price: 100, image: IMAGES.theatre, desc: 'Enjoy immersive cinematic experiences.' },
  { id: 13, name: 'ROCKET EJECTOR', price: 150, image: IMAGES.rocket, desc: 'Feel the adrenaline! Blast off.' },
  { id: 14, name: 'SURFER RIDE', price: 150, image: IMAGES.surfer, desc: 'Catch the wave on this high-speed spinning platform.' },
  { id: 15, name: 'TRAMPOLINE', price: 100, image: IMAGES.bouncy, desc: 'Jump and flip in our high-performance zone.' },
  { id: 16, name: 'BATTERY CAR', price: 100, image: IMAGES.bumping, desc: 'Mini luxury cars for the little ones.' },
  { id: 17, name: 'MEET DOWN', price: 120, image: IMAGES.surfer, desc: 'Duck and jump! A competitive mechanical sweeper game.' },
  { id: 18, name: '360 RIDE', price: 150, image: IMAGES.rocket, desc: 'Defy gravity! This intense ride rotates you a full 360 degrees.' },
  { id: 19, name: 'BULL RIDE', price: 150, image: IMAGES.bumping, desc: 'Hold on tight! Test your strength against our mechanical bull.' },
  { id: 20, name: 'BREAK DANCE', price: 150, image: IMAGES.surfer, desc: 'High-speed spinning and tilting action with vibrant lights.' },
  { id: 21, name: 'Cricket (3 Overs)', price: 150, image: IMAGES.cricket, desc: 'High-tech cricket simulator with professional-level game play.' },
  { id: 22, name: 'VR Game', price: 150, image: IMAGES.vr, desc: 'Enter a new world with our premium VR gaming setup.' },
  { id: 23, name: 'Air Hockey', price: 100, image: IMAGES.air_hockey, desc: 'Classic fast-paced arcade excitement.' },
  { id: 24, name: 'Massage Chair', price: 100, image: IMAGES.massage, desc: 'Relax and rejuvenate in our luxury semi-gravity massage chairs.' },
  { id: 25, name: 'Softplay', price: 150, image: IMAGES.softplay, desc: 'A safe and vibrant indoor play area for young children.' },
];

function MainApp() {
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const blinkAnim = useRef(new Animated.Value(1)).current;
  
  const [btModalVisible, setBtModalVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [showAllRides, setShowAllRides] = useState(false);
  
  const [scannedDevices, setScannedDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [cart, setCart] = useState([]);
  const [mobile, setMobile] = useState('');

  const isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;

  const addToCart = (ride) => {
    setCart([...cart, { ...ride, cartId: Math.random().toString() }]);
  };

  const removeFromCart = (cartId) => {
    setCart(cart.filter(item => item.cartId !== cartId));
  };

  const clearCart = () => { setCart([]); setMobile(''); setCartModalVisible(false); };

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      if (Platform.Version >= 31) {
        permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      return Object.values(granted).every(res => res === PermissionsAndroid.RESULTS.GRANTED);
    }
    return true;
  };

  const connectToDevice = async (device) => {
    if (!BLEPrinter) return;
    setIsConnecting(true);
    try {
      const address = device.inner_mac_address || device.address;
      await BLEPrinter.connectPrinter(address);
      setConnectedDevice(device);
      setBtModalVisible(false);
    } catch (e) { Alert.alert('Connection Failed', 'Ensure BT is ON.'); } finally { setIsConnecting(false); }
  };

  const startScan = async () => {
    if (!BLEPrinter) return;
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    setIsScanning(true);
    try {
      await BLEPrinter.init();
      const devices = await BLEPrinter.getDeviceList();
      setScannedDevices(devices);
      const target = devices.find(d => (d.device_name || d.name || '').toLowerCase().includes(TARGET_PRINTER_NAME.toLowerCase()));
      if (target && !connectedDevice) connectToDevice(target);
    } catch (e) { console.error(e); } finally { setIsScanning(false); }
  };

  useEffect(() => {
    startScan();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const printTicket = async () => {
    if (!connectedDevice) { Alert.alert('Printer Required', 'Please connect BT.'); return; }
    if (cart.length === 0) return;
    try {
      let receipt = `
ETHREE POS - FINAL TICKET
--------------------------------
DATE: ${new Date().toLocaleString()}
MOBILE: ${mobile || 'N/A'}
--------------------------------\n`;
      cart.forEach(item => { receipt += `${item.name.padEnd(20)} ₹${item.price}\n`; });
      receipt += `--------------------------------
TOTAL:                ₹${subtotal}
--------------------------------
THANK YOU FOR YOUR VISIT!
\n\n\n\n`;
      await BLEPrinter.printText(receipt);
      Alert.alert('Success', 'Final Ticket Printed!');
      clearCart();
    } catch (e) { Alert.alert('Error', 'Print failed.'); }
  };

  const renderRideCard = ({ item }) => {
    const cardWidth = isLandscape ? (width * 0.6 / 2) - 15 : (width / 2) - 15;
    return (
      <View style={[styles.rideCard, { width: cardWidth, height: cardWidth + 55 }]}>
        <Image source={item.image} style={styles.rideImage} />
        <View style={styles.priceBadge}><Text style={styles.priceBadgeText}>₹{item.price}</Text></View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={3}>{item.desc}</Text>
          <TouchableOpacity style={styles.addToOrderButton} onPress={() => addToCart(item)}>
            <Ionicons name="add-circle" size={14} color="#0084c2" />
            <Text style={styles.addToOrderText}>ADD</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSummary = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.cartIconBox}><Ionicons name="cart-outline" size={18} color="#0f172a" /></View>
        <View style={{flex: 1, marginLeft: 10}}>
          <Text style={styles.summaryLabel}>CURRENT ORDER</Text>
          <Text style={styles.summaryTitle}>Ticket Summary</Text>
        </View>
        <View style={styles.cartCount}><Text style={styles.cartCountText}>{cart.length}</Text></View>
      </View>
      <ScrollView style={styles.cartItemsList}>
        {cart.map((item) => (
          <View key={item.cartId} style={styles.cartItem}>
            <Text style={styles.cartItemName}>{item.name}</Text>
            <Text style={styles.cartItemPrice}>₹{item.price}</Text>
            <TouchableOpacity onPress={() => removeFromCart(item.cartId)}><Ionicons name="close-circle" size={16} color="#ef4444" /></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>CUSTOMER MOBILE</Text>
        <TextInput style={styles.mobileInput} placeholder="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="numeric" maxLength={10} />
      </View>
      <TouchableOpacity style={styles.upiButton}>
        <Ionicons name="qr-code-outline" size={18} color="#0084c2" />
        <Text style={styles.upiText}>UPI / QR PAYMENT</Text>
      </TouchableOpacity>
      <View style={styles.footerRow}><Text style={styles.footerLabel}>Subtotal</Text><Text style={styles.footerValue}>₹{subtotal}</Text></View>
      <View style={styles.finalPayCard}>
        <View style={{flex: 1}}><Text style={styles.payLabel}>TOTAL</Text><Text style={styles.payAmount}>₹{subtotal}</Text></View>
        <View style={{alignItems: 'flex-end'}}><Text style={styles.readyText}>READY</Text></View>
      </View>
      <View style={styles.footerActions}>
        <TouchableOpacity style={styles.deleteButton} onPress={clearCart}><Ionicons name="trash-outline" size={20} color="#94a3b8" /></TouchableOpacity>
        <TouchableOpacity style={styles.printTicketButton} onPress={printTicket}>
          <Ionicons name="print" size={20} color="#f0c05a" />
          <Text style={styles.printTicketText}>PRINT TICKET</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const displayedRides = showAllRides ? RIDES_DATA : RIDES_DATA.slice(0, 3);
  const footerCard = showAllRides 
    ? { id: 'show-less', title: 'SHOW LESS', icon: 'chevron-up' } 
    : { id: 'show-more', title: 'MORE', icon: 'refresh' };

  return (
    <View style={styles.root}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerContent}>
          <Image source={require('./assets/public/logo.jpeg')} style={styles.logo} resizeMode="contain" />
          <View style={styles.textContainer}>
            <Text style={styles.ethreeText}>ETHREE</Text>
            <Text style={styles.posText}> POS</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusIndicator, isOnline ? styles.onlineBg : styles.offlineBg]}>
              <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
            <TouchableOpacity style={[styles.btButton, connectedDevice ? styles.btConnected : styles.btDisconnected]} onPress={() => {setBtModalVisible(true); startScan();}}>
              <View style={[styles.statusDot, connectedDevice ? styles.btDotOn : styles.btDotOff]} />
              <Text style={styles.btText}>{connectedDevice ? 'BT ON' : 'BT OFF'}</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <View style={styles.archBox}>
               <Image source={IMAGES.stackvil} style={styles.stackvilLogo} resizeMode="contain" />
               <View><Text style={styles.archTitle}>STACKVIL</Text></View>
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.subNav}>
         <View style={styles.subNavAccent} />
         <Text style={styles.subNavText}>Available Rides</Text>
      </View>

      <View style={[styles.mainContainer, { flexDirection: isLandscape ? 'row' : 'column' }]}>
        <View style={[styles.leftPanel, { flex: isLandscape ? 3 : 1 }]}>
           <FlatList
             data={[...displayedRides, footerCard]}
             key={isLandscape ? 'h' : 'v'}
             numColumns={2}
             showsVerticalScrollIndicator={false}
             contentContainerStyle={styles.cardList}
             renderItem={({ item }) => {
                const cardWidth = isLandscape ? (width * 0.65 / 2) - 15 : (width / 2) - 15;
                if (item.id === 'show-more' || item.id === 'show-less') return (
                  <TouchableOpacity style={[styles.showMoreCard, { width: cardWidth, height: cardWidth + 55 }]} onPress={() => setShowAllRides(!showAllRides)}>
                    <View style={styles.refreshCircle}><Ionicons name={item.icon} size={24} color="#94a3b8" /></View>
                    <Text style={styles.showMoreTitle}>{item.title}</Text>
                  </TouchableOpacity>
                );
                return renderRideCard({ item });
             }}
           />
        </View>

        {isLandscape && <View style={styles.rightPanel}>{renderSummary()}</View>}
      </View>

      {!isLandscape && cart.length > 0 && (
        <TouchableOpacity style={[styles.viewCartFAB, { bottom: insets.bottom + 20 }]} onPress={() => setCartModalVisible(true)}>
           <Ionicons name="cart" size={22} color="#fff" />
           <Text style={styles.viewCartText}>VIEW CART • ₹{subtotal}</Text>
        </TouchableOpacity>
      )}

      <Modal animationType="slide" visible={cartModalVisible} onRequestClose={() => setCartModalVisible(false)}>
         <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Your Order</Text>
               <TouchableOpacity onPress={() => setCartModalVisible(false)}><Ionicons name="close" size={30} color="#0f172a" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>{renderSummary()}</View>
         </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={btModalVisible} onRequestClose={() => setBtModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Connect Printer</Text><TouchableOpacity onPress={() => setBtModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity></View>
          <FlatList data={scannedDevices} keyExtractor={(item) => item.inner_mac_address} renderItem={({ item }) => (
            <TouchableOpacity style={styles.printerItem} onPress={() => connectToDevice(item)}><Ionicons name="bluetooth" size={20} color="#0084c2" /><Text style={styles.printerName}>{item.device_name || 'Unknown'}</Text></TouchableOpacity>
          )} />
        </View></View>
      </Modal>
      <StatusBar hidden />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#0a0e17', paddingBottom: 6 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  logo: { width: 22, height: 22, marginRight: 8 },
  textContainer: { flexDirection: 'row', alignItems: 'center' },
  ethreeText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  posText: { color: '#f0c05a', fontSize: 14, fontWeight: '900' },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1 },
  onlineBg: { backgroundColor: '#06231e', borderColor: '#0b5b4a' },
  offlineBg: { backgroundColor: '#2d2605', borderColor: '#6b5c0a' },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  onlineDot: { backgroundColor: '#00cc99' },
  offlineDot: { backgroundColor: '#f0c05a' },
  statusText: { fontSize: 8, fontWeight: 'bold', color: '#fff' },
  btButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginLeft: 6 },
  btDisconnected: { backgroundColor: '#0f172a', borderColor: '#334155' },
  btConnected: { backgroundColor: '#0084c2', borderColor: '#ffffff' },
  btDotOff: { backgroundColor: '#475569' },
  btDotOn: { backgroundColor: '#ffffff' },
  btText: { fontSize: 8, fontWeight: 'bold', color: '#fff' },
  divider: { width: 1, height: 18, backgroundColor: '#334155', marginHorizontal: 10 },
  archBox: { flexDirection: 'row', alignItems: 'center' },
  stackvilLogo: { width: 18, height: 18, marginRight: 5 },
  archTitle: { color: '#f0c05a', fontSize: 7, fontWeight: 'bold' },
  subNav: { backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15 },
  subNavAccent: { width: 3, height: 16, backgroundColor: '#f0c05a', borderRadius: 1.5, marginRight: 8 },
  subNavText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  mainContainer: { flex: 1, padding: 6 },
  leftPanel: { flex: 1 },
  cardList: { paddingBottom: 100 },
  rideCard: { backgroundColor: '#ffffff', borderRadius: 12, margin: 4, elevation: 2, overflow: 'hidden' },
  rideImage: { width: '100%', height: '60%' },
  priceBadge: { position: 'absolute', top: '50%', right: 6, backgroundColor: '#f0c05a', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  priceBadgeText: { color: '#0f172a', fontWeight: '900', fontSize: 9 },
  cardContent: { padding: 6, flex: 1, justifyContent: 'space-between' },
  cardTitle: { fontSize: 11, fontWeight: '900', color: '#1e293b' },
  cardDesc: { fontSize: 9, color: '#64748b', fontWeight: '400', lineHeight: 12, marginVertical: 4 },
  addToOrderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingVertical: 4 },
  addToOrderText: { marginLeft: 3, color: '#0084c2', fontWeight: 'bold', fontSize: 8 },
  showMoreCard: { borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', margin: 4 },
  refreshCircle: { backgroundColor: '#f1f5f9', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  showMoreTitle: { fontSize: 8, fontWeight: 'bold', color: '#64748b' },
  rightPanel: { flex: 2, marginLeft: 8 },
  summaryCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 10, flex: 1 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cartIconBox: { backgroundColor: '#f8fafc', width: 24, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { color: '#64748b', fontSize: 7, fontWeight: 'bold' },
  summaryTitle: { fontSize: 11, fontWeight: '900', color: '#1e293b' },
  cartCount: { backgroundColor: '#0f172a', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  cartCountText: { color: '#fff', fontSize: 7, fontWeight: 'bold' },
  cartItemsList: { marginVertical: 6, flex: 1 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  cartItemName: { flex: 1, fontSize: 10, fontWeight: 'bold', color: '#1e293b' },
  cartItemPrice: { fontSize: 9, color: '#64748b', marginRight: 6 },
  inputSection: { marginTop: 6 },
  inputLabel: { color: '#64748b', fontSize: 7, fontWeight: 'bold', marginBottom: 2 },
  mobileInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 6, fontSize: 10, color: '#1e293b' },
  upiButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#0084c2', borderRadius: 6, padding: 6, marginTop: 6 },
  upiText: { marginLeft: 5, color: '#0084c2', fontWeight: 'bold', fontSize: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  footerLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 9 },
  footerValue: { color: '#1e293b', fontWeight: 'bold', fontSize: 9 },
  finalPayCard: { backgroundColor: '#0a0e17', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  payLabel: { color: '#64748b', fontSize: 7, fontWeight: 'bold' },
  payAmount: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  readyText: { color: '#00cc99', fontSize: 8, fontWeight: 'bold' },
  footerActions: { flexDirection: 'row', marginTop: 8 },
  deleteButton: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginRight: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  printTicketButton: { flex: 1, backgroundColor: '#0f172a', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  printTicketText: { color: '#ffffff', fontWeight: 'bold', marginLeft: 5, fontSize: 10 },
  viewCartFAB: { position: 'absolute', right: 20, left: 20, backgroundColor: '#0f172a', borderRadius: 30, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  viewCartText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 8 },
  modalRoot: { flex: 1, backgroundColor: '#f4f7f9' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff' },
  modalBody: { flex: 1, padding: 8 },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 15, padding: 15 },
  printerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  printerName: { fontSize: 12, marginLeft: 12, color: '#1e293b' },
});

export default function App() { 
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  ); 
}
