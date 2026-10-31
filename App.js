import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Image, Text, Animated, ScrollView, TouchableOpacity, Modal, FlatList, Platform, PermissionsAndroid, Alert, ActivityIndicator, useWindowDimensions, TextInput, RefreshControl, Linking, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, storage } from './src/api/config';
import Login from './src/pages/Login';
import AdminDashboard from './src/pages/AdminDashboard';
import PaymentWebView from './src/components/PaymentWebView';
import PaymentStatus from './src/components/PaymentStatus';
import RideReceiptModal from './src/components/RideReceiptModal';
import {
  initiateRidePayment,
  launchEasebuzzPortal,
  dismissEasebuzzPortal,
  parseDeepLinkUrl,
  verifyPaymentStatus,
  pollPaymentStatus,
} from './src/api/paymentService';
import { generateGatewayHtml } from './src/utils/paymentGatewayHtml';
import { generateTicketsForCart } from './src/utils/TicketFormatter';
import PrinterService, { isNativePrinter, safePrint } from './src/utils/PrinterService';
import { RideCardImage, getRideDescription, FALLBACK_IMAGE } from './src/utils/rideImages';
import PRELOADED_RIDES from './assets/data/rides.json';

const FEATURED_NAMES = ['TL TRAIN', 'ETHREE BUS', 'SUN @ MOON'];
const TARGET_PRINTER_NAME = 'Printer001-08D0';

function MainApp({ user, onLogout }) {
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const isPrinting = useRef(false);
  const lastPrintTime = useRef(0);
  const hasAutoTested = useRef(false);

  const [isAdminView, setIsAdminView] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [showAllRides, setShowAllRides] = useState(false);
  
  const [btStatus, setBtStatus] = useState('disconnected');
  const [rides, setRides] = useState(PRELOADED_RIDES || []);
  const [loadingRides, setLoadingRides] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [cart, setCart] = useState([]);
  const [mobile, setMobile] = useState('');
  
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [paymentHtml, setPaymentHtml] = useState(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMode, setStatusMode] = useState('awaiting'); // awaiting, success, error
  const [isPrintingState, setIsPrintingState] = useState(false);
  const [currentTxnId, setCurrentTxnId] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Active payment state reference for deep links and app resume tracking
  const activePaymentRef = useRef({
    inProgress: false,
    isProcessed: false,
    txnid: null,
    cart: [],
    amount: 0,
    mobile: '',
    startTime: 0,
  });
  const livePollingTimer = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const stopLivePolling = () => {
    if (livePollingTimer.current) {
      console.log('[Live Polling] Stopping poller.');
      clearInterval(livePollingTimer.current);
      livePollingTimer.current = null;
    }
  };

  const startLivePolling = (txnIdToPoll) => {
    stopLivePolling();
    console.log('[Live Polling] Starting continuous poller (1.5s interval) for txnid:', txnIdToPoll);
    let attempts = 0;
    const maxAttempts = 120; // 3 minutes total

    livePollingTimer.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts || !activePaymentRef.current.inProgress) {
        console.log('[Live Polling] Stopping poller (timeout or cancelled).');
        stopLivePolling();
        return;
      }

      try {
        const verifyRes = await verifyPaymentStatus(txnIdToPoll);
        if (verifyRes.verified || verifyRes.status === 'success' || verifyRes.data?.isPaid === true) {
          console.log('[Live Polling] >>> SUCCESS CONFIRMED BY EASEBUZZ! <<< Dismissing browser and printing ticket.');
          stopLivePolling();

          // 1. Dismiss In-App Browser (Chrome Custom Tab) to return to POS app
          await dismissEasebuzzPortal();

          // 2. Dismiss In-App Webview if open
          setPaymentVisible(false);

          // 3. Try to bring POS MainActivity to front if external browser was active
          try {
            await Linking.openURL(`yourrideapp://payment/callback?status=success&txnid=${txnIdToPoll}`);
          } catch (e) {
            console.log('[Live Polling] Deep link intent trigger:', e.message);
          }

          // 4. Dismiss status modal
          setStatusVisible(false);

          // 5. Process successful payment, wipe cart, sync & print ticket
          await processSuccessfulPayment(txnIdToPoll, verifyRes);
        } else if (verifyRes.failed) {
          console.log('[Live Polling] Gateway reported payment failure.');
          stopLivePolling();
          await dismissEasebuzzPortal();
          setPaymentVisible(false);
          await processFailedPayment(txnIdToPoll, 'Payment was marked as failed.');
        }
      } catch (pollErr) {
        console.warn('[Live Polling] Poller iteration error:', pollErr.message);
      }
    }, 1500);
  };



  // Connection Loop
  const autoConnect = async (force = false) => {
    if (btStatus === 'connected' && !force) return;
    try {
      console.log('PrinterService: Searching for devices...');
      setBtStatus('connecting');
      
      // Clear any stale native connection before re-scanning
      if (PrinterService.closeConn) await PrinterService.closeConn();
      
      const devices = await PrinterService.getDeviceList();
      console.log('PrinterService: Found devices:', JSON.stringify(devices));
      
      const target = devices.find(d => {
        const name = (d.device_name || d.name || '').toLowerCase();
        return name.includes(TARGET_PRINTER_NAME.toLowerCase()) || name.includes('printer');
      });

      if (target) {
        console.log('PrinterService: Target found, connecting to:', target.device_name || target.name);
        
        // Use a timeout to avoid hanging on offline devices
        const connection = PrinterService.connectPrinter(target.inner_mac_address || target.address);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 8000));
        
        await Promise.race([connection, timeout]);
        
        // Wait for native stabilization without triggering a print
        await new Promise(r => setTimeout(r, 3000)); 
        
        setBtStatus('connected');
        if (force) Alert.alert('Printer Linked', `App is now linked to ${target.device_name || target.name}. Note: If the printer is physically off, it may still show as linked if it was previously paired.`);
        
        // Auto-test print on first connection of the session
        if (!hasAutoTested.current) {
          hasAutoTested.current = true;
          console.log('PrinterService: Triggering automatic initial test print');
          setTimeout(() => {
            handleTestPrint();
          }, 1000);
        }
      } else {
        console.log('PrinterService: Target not found in list.');
        setBtStatus('disconnected');
        if (force) Alert.alert('Printer Not Found', 'Could not find any printer device nearby. Please ensure printer is ON and Bluetooth is enabled.');
      }
    } catch (e) { 
        console.error('PrinterService: Connection failed:', e);
        setBtStatus('disconnected'); 
        if (force) Alert.alert('Connection Failed', e.message || 'Unknown error');
    }
  };

  useEffect(() => {
    fetchRides();
    const init = async () => {
        if (Platform.OS === 'android') {
            try {
              await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              ]);
            } catch (e) {}
        }
        if (!isNativePrinter) {
          console.warn('PrinterService: Using Mock Printer (Native module not loaded)');
        }
        await PrinterService.init();
        autoConnect();
    };
    init();
    checkPendingSyncs();
    const timer = setInterval(() => { if (btStatus !== 'connected') autoConnect(); }, 30000);
    const syncTimer = setInterval(() => { checkPendingSyncs(); }, 30000);
    return () => { clearInterval(timer); clearInterval(syncTimer); };
  }, []);

  const checkPendingSyncs = async () => {
    try {
        const pendingStr = await storage.getItem('pending_syncs');
        const pending = pendingStr ? JSON.parse(pendingStr) : [];
        setPendingSyncCount(pending.length);
        if (pending.length > 0 && netInfo.isConnected) {
            console.log('Attempting to sync pending transactions:', pending.length);
            const token = await storage.getToken();
            const stillPending = [];
            for (const records of pending) {
                try {
                    await axios.post(`${API_URL}/api/tickets`, records, { headers: { Authorization: `Bearer ${token}` } });
                    
                    try {
                        const ticketId = records[0].isMaster ? records[0].id : records[0].parentId;
                        const archiveStr = await storage.getItem('local_archive');
                        const archive = archiveStr ? JSON.parse(archiveStr) : [];
                        const idx = archive.findIndex(a => a.id === ticketId);
                        if (idx !== -1) {
                            archive[idx].synced = true;
                            await storage.setItem('local_archive', JSON.stringify(archive));
                        }
                    } catch (err) {}

                } catch (e) {
                    stillPending.push(records);
                }
            }
            await storage.setItem('pending_syncs', JSON.stringify(stillPending));
            setPendingSyncCount(stillPending.length);
        }
    } catch (e) {}
  };


  const fetchRides = async () => {
    try {
      const token = await storage.getToken();
      console.log('Fetching rides from:', `${API_URL}/api/products`);
      const headers = { 'ngrok-skip-browser-warning': 'true' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${API_URL}/api/products?t=${Date.now()}`, {
        headers,
        timeout: 4000
      });
      
      if (response.data && response.data.length > 0) {
        const enriched = response.data
          .filter(r => r.name !== 'Free Ride' && r.name !== 'Ticket Summary' && r.status !== 'off')
          .map(r => ({
            ...r,
            description: r.description || getRideDescription(r),
          }));
        setRides(enriched);
      }
    } catch (err) { 
      console.warn('API Fetch Failed, keeping preloaded rides:', err.message);
    } finally { 
      setLoadingRides(false); 
      setRefreshing(false); 
    }
  };


  const addToCart = (ride) => {
    const existing = cart.find(i => (i.id || i._id) === (ride.id || ride._id));
    if (existing) {
        setCart(cart.map(i => (i.id || i._id) === (ride.id || ride._id) ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
        setCart([...cart, { ...ride, quantity: 1, cartId: Math.random().toString() }]);
    }
  };

  const updateQuantity = (cartId, delta) => {
    setCart(cart.map(item => (item.cartId === cartId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)).filter(i => i.quantity > 0));
  };

  const updateArchiveStatus = async (txnId, status) => {
    if (!txnId) return;
    try {
      const archiveStr = await storage.getItem('local_archive');
      const archive = archiveStr ? JSON.parse(archiveStr) : [];
      const idx = archive.findIndex(a => a.id === txnId);
      if (idx !== -1) {
        archive[idx].status = status;
        await storage.setItem('local_archive', JSON.stringify(archive));
      }
    } catch (e) {
      console.error('Update archive status error:', e);
    }
  };

  /**
   * 1. Initiate Payment Request
   * Calls backend payment initiate endpoint passing ride identifier and required parameters.
   * Extracts payment_url and txnid from the response.
   * 2. Launches Live Easebuzz Portal in In-App Browser / Custom Tab / Safari View.
   */
  const initiatePayment = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please select at least one ride to pay fare.');
      return;
    }
    setPaymentModalVisible(false);

    const txnId = `ETH-${Date.now().toString().slice(-8)}`;
    setCurrentTxnId(txnId);
    const totalAmount = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const cartSnapshot = [...cart];
    const mobileSnapshot = mobile;

    // 1. Log Attempt to Local Archive with 'initiated' status
    try {
      const archiveStr = await storage.getItem('local_archive');
      const archive = archiveStr ? JSON.parse(archiveStr) : [];
      const newRecord = {
        id: txnId,
        amount: totalAmount,
        items: cartSnapshot,
        mobile: mobileSnapshot,
        paymentMode: 'Easebuzz Live (UPI)',
        posId: 'pos1',
        createdAt: new Date().toISOString(),
        status: 'initiated',
        synced: false,
        createdBy: user?.name || 'Staff',
      };
      archive.unshift(newRecord);
      await storage.setItem('local_archive', JSON.stringify(archive));
    } catch (e) {
      console.error('Archive Init Error:', e);
    }

    // Set tracking ref for deep link, polling & app resume fallback
    activePaymentRef.current = {
      inProgress: true,
      isProcessed: false,
      txnid: txnId,
      cart: cartSnapshot,
      amount: totalAmount,
      mobile: mobileSnapshot,
      startTime: Date.now(),
    };

    // 2. Call backend payment initiation endpoint
    let livePortalLaunched = false;
    try {
      setStatusMode('awaiting');
      setStatusVisible(true);

      const initiateRes = await initiateRidePayment({
        rides: cartSnapshot,
        amount: totalAmount,
        customerPhone: mobileSnapshot,
        customerName: user?.name || 'Passenger',
        customerEmail: user?.email || 'passenger@ethree.com',
        txnId: txnId,
      });

      // Extract payment_url and txnid from response
      const paymentUrlToLaunch = initiateRes.payment_url;
      const returnedTxnId = initiateRes.txnid || txnId;
      setCurrentTxnId(returnedTxnId);
      activePaymentRef.current.txnid = returnedTxnId;
      activePaymentRef.current.isProcessed = false;

      console.log('[Easebuzz Live] Opening portal URL:', paymentUrlToLaunch);

      // 1. Start continuous 1.5s active polling immediately so payment is detected while browser is open
      startLivePolling(returnedTxnId);

      // 2. Launch Live Gateway non-blockingly (DO NOT await so poller runs simultaneously)
      launchEasebuzzPortal(paymentUrlToLaunch)
        .then((res) => {
          console.log('[Easebuzz Portal] Browser dismissed or closed:', res);
          // Safety check: if user manually closed browser, verify immediately
          if (activePaymentRef.current.inProgress && !activePaymentRef.current.isProcessed) {
            verifyPaymentStatus(returnedTxnId).then((chk) => {
              if (chk.verified || chk.data?.isPaid === true) {
                stopLivePolling();
                processSuccessfulPayment(returnedTxnId, chk);
              }
            });
          }
        })
        .catch((portalErr) => {
          console.warn('[Easebuzz Portal] Launch failed, opening built-in webview:', portalErr.message);
          setPaymentUrl(paymentUrlToLaunch);
          setPaymentHtml(null);
          setPaymentVisible(true);
        });

      livePortalLaunched = true;
    } catch (apiErr) {
      console.warn('[Easebuzz Live] Initiation endpoint failed, falling back to built-in webview:', apiErr.message);
    }

    if (!livePortalLaunched) {
      // Fallback: Built-in Online Payment Gateway Webview
      try {
        const merchantUpi = (await storage.getItem('merchant_upi_id')) || '7036923456@ybl';
        const html = generateGatewayHtml({
          amount: totalAmount,
          txnId: txnId,
          mobile: mobileSnapshot,
          merchantUpi: merchantUpi,
          apiBaseUrl: API_URL,
        });
        setStatusVisible(false);
        setPaymentUrl(null);
        setPaymentHtml(html);
        setPaymentVisible(true);
      } catch (err) {
        activePaymentRef.current.inProgress = false;
        setStatusMode('error');
        setStatusVisible(true);
      }
    }
  };

  /**
   * UI Transition & Receipt Confirmation Screen
   * Updates local ride state to paid and shows confirmed receipt.
   */
  const handlePaymentConfirmed = async (ticketId, paymentModeToUse = 'Easebuzz Live (UPI)', items = null, custMobile = null) => {
    const itemsToConfirm = items && items.length > 0 ? items : (activePaymentRef.current.cart?.length > 0 ? activePaymentRef.current.cart : [...cart]);
    const mobileToConfirm = custMobile !== null && custMobile !== undefined ? custMobile : (activePaymentRef.current.mobile || mobile);
    const totalAmount = itemsToConfirm.reduce((s, i) => s + (i.price * i.quantity), 0);

    // Update local ride state to paid
    await updateArchiveStatus(ticketId, 'paid');

    // Populate Receipt and navigate to Ride Receipt / Confirmation screen
    setConfirmedReceipt({
      id: ticketId,
      amount: totalAmount,
      items: itemsToConfirm,
      mobile: mobileToConfirm,
      paymentMode: paymentModeToUse,
      createdAt: new Date().toISOString(),
      status: 'paid',
    });
    setReceiptModalVisible(true);
    setStatusVisible(false);

    // Print ticket and sync to backend database
    await executePrintAndSync(ticketId, paymentModeToUse, itemsToConfirm, mobileToConfirm);

    // Fully automatic hands-free: auto-dismiss receipt after 4s without tapping any button
    setTimeout(() => {
      setReceiptModalVisible(false);
    }, 4000);
  };

  /**
   * 3. Deep Link & Verification Handling
   * If status === "success":
   * Call backend status verification endpoint for txnid to confirm backend database sync.
   * Update local ride state to paid.
   * Navigate to Ride Receipt / Confirmed screen.
   */
  const processSuccessfulPayment = async (txnid, preVerifiedResult = null) => {
    if (activePaymentRef.current.isProcessed) {
      console.log('[Verification] Payment already processed for txnid:', txnid);
      return;
    }
    activePaymentRef.current.isProcessed = true;
    activePaymentRef.current.inProgress = false;
    stopLivePolling();

    try {
      setIsVerifyingPayment(true);
      setStatusMode('awaiting');

      let verifyResult = preVerifiedResult;
      if (!verifyResult || !verifyResult.verified) {
        console.log('[Verification] Confirming txnid with backend:', txnid);
        verifyResult = await verifyPaymentStatus(txnid);
        console.log('[Verification] Backend response:', verifyResult);
      }

      if (verifyResult.verified || verifyResult.status === 'success' || verifyResult.status === 'paid' || verifyResult.data?.isPaid === true) {
        const savedCart = [...(activePaymentRef.current.cart || [])];
        const savedMobile = activePaymentRef.current.mobile;

        await handlePaymentConfirmed(txnid, 'Easebuzz Live (UPI)', savedCart, savedMobile);
      } else {
        await updateArchiveStatus(txnid, 'failed');
        setStatusMode('error');
        setStatusVisible(true);
        Alert.alert(
          'Verification Notice',
          'Payment callback received, but transaction confirmation with backend is pending. Please check with staff or retry.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('[Verification Error]:', err);
      setStatusMode('error');
      setStatusVisible(true);
      Alert.alert('Verification Error', err.message || 'Error communicating with verification service.');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  /**
   * Deep Link Failure Handling
   * If status !== "success":
   * Display payment failure alert / toast and allow passenger to retry.
   */
  const processFailedPayment = async (txnid, message = 'Payment could not be completed.') => {
    stopLivePolling();
    activePaymentRef.current.inProgress = false;
    await updateArchiveStatus(txnid, 'failed');
    setStatusMode('error');
    setStatusVisible(true);
    Alert.alert(
      'Payment Failed',
      message || 'Your payment was not completed on Easebuzz. Please retry your payment.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setStatusVisible(false) },
        { text: 'Retry Payment', onPress: () => initiatePayment() },
      ]
    );
  };

  /**
   * Callback handler for deep links (e.g. yourrideapp://payment/callback)
   */
  const handleDeepLinkCallback = async (incomingUrl) => {
    if (!incomingUrl) return;
    console.log('[DeepLink] Callback URL received:', incomingUrl);

    const parsed = parseDeepLinkUrl(incomingUrl);
    if (!parsed.isPaymentCallback && !parsed.status && !activePaymentRef.current.inProgress) {
      return;
    }

    const txnid = parsed.txnid || activePaymentRef.current.txnid || currentTxnId;

    // Dismiss the in-app browser / custom tab immediately
    stopLivePolling();
    await dismissEasebuzzPortal();
    setPaymentVisible(false);

    if (activePaymentRef.current.isProcessed) {
      console.log('[DeepLink] Payment already processed for txnid:', txnid);
      return;
    }

    if (parsed.status === 'success') {
      await processSuccessfulPayment(txnid);
    } else {
      await processFailedPayment(
        txnid,
        parsed.params?.error_Message || 'Payment was cancelled or unsuccessful.'
      );
    }
  };

  /**
   * 4. App Lifecycle Resume (Fallback Verification)
   * Add a check on app resume (AppState.active):
   * If a ride payment was in-progress and passenger switches back to the app without triggering the deep link,
   * poll backend status API for txnid to sync and confirm the payment state.
   */
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev.match(/inactive|background/) && nextState === 'active') {
        console.log('[AppState] App resumed to ACTIVE state.');

        if (activePaymentRef.current.inProgress && activePaymentRef.current.txnid) {
          const txnid = activePaymentRef.current.txnid;
          console.log('[AppState Resume] Payment in-progress detected, polling backend status API for txnid:', txnid);

          // Brief delay before query
          await new Promise(r => setTimeout(r, 1200));

          const pollResult = await pollPaymentStatus(txnid, { maxAttempts: 3, delayMs: 1500 });
          if (pollResult.verified) {
            console.log('[AppState Resume] Payment verified via fallback polling!');
            await dismissEasebuzzPortal();
            await processSuccessfulPayment(txnid);
          } else if (pollResult.failed) {
            console.log('[AppState Resume] Payment marked as failed by gateway.');
            await dismissEasebuzzPortal();
            await processFailedPayment(txnid, 'Payment was marked as failed.');
          } else {
            console.log('[AppState Resume] Payment still in progress or waiting.');
          }
        }
      }
    });

    // Handle deep link from cold start
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[DeepLink] Cold start URL:', url);
        handleDeepLinkCallback(url);
      }
    });

    // Handle deep link when app is running/backgrounded
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink] Linking event URL:', url);
      handleDeepLinkCallback(url);
    });

    return () => {
      stopLivePolling();
      appStateSub.remove();
      linkSub.remove();
    };
  }, []);

  const executePrintAndSync = async (ticketId, paymentModeToUse, itemsToUse = null, customerMobile = null) => {
    // 1. Triple-Lock and Instant Wipe
    const now = Date.now();
    if (isPrinting.current || isPrintingState || (now - lastPrintTime.current < 4000)) return;
    
    const cartToPrint = itemsToUse && itemsToUse.length > 0 ? itemsToUse : [...cart];
    if (cartToPrint.length === 0) return;

    const mobileToUse = customerMobile !== null && customerMobile !== undefined ? customerMobile : mobile;

    isPrinting.current = true;
    setIsPrintingState(true);
    lastPrintTime.current = now;
    
    setCart([]); // WIPE CART IMMEDIATELY
    setMobile('');
    setCartModalVisible(false);
    setPaymentVisible(false);
    
    const allRecords = generateTicketsForCart(cartToPrint, ticketId, mobileToUse, user, paymentModeToUse);
    const ticketsToPrint = allRecords.filter(r => !r.isMaster);
    
    // 2. INSTANTLY save to Local Archive with 'paid' status before anything else
    try {
        const archiveStr = await storage.getItem('local_archive');
        const archive = archiveStr ? JSON.parse(archiveStr) : [];
        const idx = archive.findIndex(a => a.id === ticketId);
        if (idx !== -1) {
            archive[idx].status = 'paid';
            archive[idx].paymentMode = paymentModeToUse;
            archive[idx].synced = false;
        } else {
            // Fallback: If not found, add it
            archive.unshift({ ...allRecords[0], status: 'paid', synced: false });
        }
        await storage.setItem('local_archive', JSON.stringify(archive));
    } catch (e) { console.error('Archive Instant Save Error:', e); }

    const runPrint = async () => {
        try {
            await autoConnect(); // Connect
            for (const t of ticketsToPrint) {
                try {
                    if (t.text) {
                        await safePrint(t.text); // Print
                        await safePrint("\x0a\x1d\x56\x00"); // Cut
                    }
                    await new Promise(r => setTimeout(r, 1200)); // Delay
                } catch (e) { 
                    console.error('Print Step Error:', e); 
                    setBtStatus('disconnected');
                }
            }
        } finally {
            isPrinting.current = false;
            setIsPrintingState(false);
        }
    };
    runPrint();

    // Sync all records (Master + Sub-tickets) to server
    const syncToServer = async () => {
        try {
            const token = await storage.getToken();
            await axios.post(`${API_URL}/api/tickets`, allRecords, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            console.log('Sync Successful:', ticketId);
            
            // Mark as synced in archive
            try {
                const archiveStr = await storage.getItem('local_archive');
                const archive = archiveStr ? JSON.parse(archiveStr) : [];
                const idx = archive.findIndex(a => a.id === ticketId);
                if (idx !== -1) {
                    archive[idx].synced = true;
                    await storage.setItem('local_archive', JSON.stringify(archive));
                }
            } catch (e) {}
        } catch (e) {
            console.error('Sync Failed, saving to pending queue:', e);
            try {
                const pendingStr = await storage.getItem('pending_syncs');
                const pending = pendingStr ? JSON.parse(pendingStr) : [];
                pending.push(allRecords);
                await storage.setItem('pending_syncs', JSON.stringify(pending));
                setPendingSyncCount(pending.length);
            } catch (storageErr) { console.error('Local Storage Error:', storageErr); }
        }
    };
    syncToServer();
  };

  const handlePaymentSuccess = () => {
      setPaymentVisible(false);
      const ticketId = currentTxnId || `TXN-${Date.now().toString().slice(-8)}`;
      processSuccessfulPayment(ticketId);
  };

  const handleUpdateMerchantUpi = async (newUpi) => {
    if (newUpi && newUpi.includes('@')) {
      await storage.setItem('merchant_upi_id', newUpi.trim());
      console.log('Saved new merchant UPI ID:', newUpi.trim());
    }
  };

  const processCashPayment = () => {
      const txnId = `ETH-${Date.now().toString().slice(-8)}`;
      setCurrentTxnId(txnId);
      handlePaymentConfirmed(txnId, 'CASH');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setPaymentModalVisible(true);
  };

  const handlePaymentFailure = () => {
    setPaymentVisible(false);
    processFailedPayment(currentTxnId, 'Payment was cancelled or failed in gateway.');
  };

  const handleTestPrint = async () => {
    try {
      await safePrint("ETHREE TEST PRINT\n" + new Date().toLocaleString() + "\n\x0a\x1d\x56\x00");
      Alert.alert('Success', 'Test print sent.');
    } catch (e) {
      Alert.alert('Error', 'Test print failed: ' + e.message);
    }
  };

  // UI Components
  const moreCardWidth = isLandscape ? (width * 0.65 / 2) - 20 : (width / 2) - 20;
  const cardHeight = isLandscape ? (height - 200) / 2 : 280;

  const renderRideCard = ({ item }) => {
    const desc = item.description || getRideDescription(item);
    return (
      <View style={[styles.rideCard, { width: moreCardWidth, height: cardHeight }]}>
        <View style={styles.imageContainer}>
            <RideCardImage item={item} style={styles.rideImage} />
            <View style={styles.imageOverlay} />
            <View style={styles.imageTextRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name.toUpperCase()}</Text>
                <View style={styles.priceTag}><Text style={styles.priceTagText}>₹{item.price}</Text></View>
            </View>
        </View>
        <View style={styles.cardFooter}>
            <Text style={styles.cardDesc} numberOfLines={isLandscape ? 1 : 2}>{desc}</Text>
            <TouchableOpacity style={styles.addBtnExact} onPress={() => addToCart(item)}>
                <View style={styles.plusCircle}><Ionicons name="add" size={12} color="#475569" /></View>
                <Text style={styles.addBtnTextExact}>Add to Order</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  const remainingCount = Math.max(0, rides.length - 3);

  const renderMoreCard = () => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => setShowAllRides(!showAllRides)} style={[styles.rideCard, styles.moreCardExact, { width: moreCardWidth, height: cardHeight }]}>
      <View style={styles.moreIconBox}><Ionicons name={showAllRides ? "close" : "add-circle"} size={32} color="#94a3b8" /></View>
      <Text style={styles.moreTitle}>{showAllRides ? 'SHOW LESS' : 'SHOW MORE RIDES'}</Text>
      {!showAllRides && remainingCount > 0 && (
        <Text style={styles.moreSubtitle}>{remainingCount} MORE AVAILABLE</Text>
      )}
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => (item.id === 'more-button' ? renderMoreCard() : renderRideCard({ item }));

  const featured = FEATURED_NAMES.map(name => 
    rides.find(r => (r.name || '').toUpperCase() === name)
  ).filter(Boolean);
  const finalDisplay = showAllRides ? rides : featured;
  const listData = [...finalDisplay];
  if (rides.length > 3) listData.push({ id: 'more-button' });

  const renderCart = () => (
    <View style={styles.cartContainer}>
      <View style={styles.cartHeader}><Ionicons name="cart" size={20} color="#1e293b" /><Text style={styles.cartHeaderText}>Current Order</Text></View>
      <ScrollView style={styles.cartScroll}>
        {cart.map((item) => (
           <View key={item.cartId} style={styles.cartItem}>
             <View style={{flex: 1}}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPrice}>₹{item.price}</Text></View>
             <View style={styles.qtyRow}>
                <TouchableOpacity onPress={() => updateQuantity(item.cartId, -1)} style={styles.qtyBtn}><Ionicons name="remove" size={12} color="#64748b" /></TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => updateQuantity(item.cartId, 1)} style={styles.qtyBtn}><Ionicons name="add" size={12} color="#64748b" /></TouchableOpacity>
             </View>
             <Text style={styles.itemTotal}>₹{item.price * item.quantity}</Text>
           </View>
        ))}
      </ScrollView>
      <View style={styles.cartFooterFull}>
        <TextInput style={styles.input} placeholder="Customer Mobile (Optional)" value={mobile} onChangeText={setMobile} keyboardType="numeric" maxLength={10} />
        <View style={styles.totalBox}>
            <View><Text style={styles.totalLabel}>Total Payable</Text><Text style={styles.totalValLarge}>₹{cart.reduce((s,i)=>s+(i.price*i.quantity),0)}</Text></View>
            <View style={styles.instantBox}><Text style={styles.instantText}>Instant Print</Text><Text style={styles.readyText}>READY</Text></View>
        </View>
        <TouchableOpacity 
            style={[styles.payBtnFull, (isPrintingState || cart.length === 0) && {opacity: 0.5}]} 
            onPress={handleCheckout}
            disabled={isPrintingState || cart.length === 0}
        >
            <View style={styles.printerCircle}>
                {isPrintingState ? <ActivityIndicator size="small" color="#0f172a" /> : <Ionicons name="print" size={14} color="#0f172a" />}
            </View>
            <Text style={styles.payBtnTextFull}>{isPrintingState ? 'PROCESSING...' : 'PAY FARE (EASEBUZZ LIVE)'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isAdminView) return <AdminDashboard onBack={() => setIsAdminView(false)} btStatus={btStatus} />;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
         <View style={styles.headerTop}>
            <Image source={require('./assets/public/logo.jpeg')} style={styles.headerLogo} />
            <Text style={styles.headerTitle}>ETHREE <Text style={{color:'#f0c05a'}}>POS</Text></Text>
            <View style={styles.headerActions}>
                <TouchableOpacity 
                    onPress={() => autoConnect(true)} 
                    style={[styles.btIndicator, {backgroundColor: btStatus === 'connected' ? '#10b981' : btStatus === 'connecting' ? '#f59e0b' : '#ef4444'}]}
                >
                    <Text style={styles.btText}>{btStatus.toUpperCase()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTestPrint} style={styles.testBtn}>
                    <Text style={styles.testBtnText}>TEST</Text>
                </TouchableOpacity>
                {pendingSyncCount > 0 && (
                    <TouchableOpacity onPress={checkPendingSyncs} style={[styles.testBtn, {backgroundColor: '#ef4444'}]}>
                        <Text style={styles.testBtnText}>{pendingSyncCount} PENDING SYNC</Text>
                    </TouchableOpacity>
                )}
                {user.role === 'admin' && <TouchableOpacity onPress={() => setIsAdminView(true)} style={styles.adminBadge}><Text style={styles.adminLabel}>ADMIN</Text></TouchableOpacity>}

                <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}><Ionicons name="log-out-outline" size={20} color="#fff" /></TouchableOpacity>
            </View>
         </View>
      </View>

      <View style={[styles.body, { flexDirection: isLandscape ? 'row' : 'column' }]}>
        <View style={[styles.leftSide, isLandscape && { flex: 2.2 }]}>
            <View style={styles.sectionHeader}><View style={styles.accent} /><Text style={styles.sectionTitle}>Available Rides</Text></View>
            <FlatList data={listData} key={isLandscape ? 'h' : 'v'} numColumns={2} contentContainerStyle={styles.list} renderItem={renderItem} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchRides();}} />} />
        </View>
        {isLandscape && <View style={styles.rightSide}>{renderCart()}</View>}
      </View>
      
      {!isLandscape && cart.length > 0 && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={() => setCartModalVisible(true)}>
             <Text style={styles.fabText}>VIEW CART • {cart.length} ITEMS</Text>
        </TouchableOpacity>
      )}

      <Modal visible={cartModalVisible} animationType="slide">
        <SafeAreaProvider style={{paddingTop: insets.top}}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Your Cart</Text><TouchableOpacity onPress={() => setCartModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity></View>
            {renderCart()}
        </SafeAreaProvider>
      </Modal>

      {/* Custom Payment Method Selection Modal */}
      <Modal visible={paymentModalVisible} transparent={true} animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPaymentModalVisible(false)}>
            <View style={styles.paymentModalBox}>
                <View style={styles.paymentMethodRow}>
                    <TouchableOpacity style={[styles.paymentMethodBtn, { backgroundColor: '#ef4444' }]} onPress={initiatePayment}>
                        <Text style={styles.paymentMethodBtnText}>U{"\n"}P{"\n"}I</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.paymentMethodBtn, { backgroundColor: '#10b981' }]} onPress={() => { setPaymentModalVisible(false); processCashPayment(); }}>
                        <Text style={styles.paymentMethodBtnText}>C{"\n"}A{"\n"}S{"\n"}H</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.paymentCancelBtn} onPress={() => setPaymentModalVisible(false)}>
                    <Text style={styles.paymentCancelText}>CANCEL</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
      </Modal>

      {/* Online Payment Gateway Webview - Hands-Free Automatic Verification */}
      <PaymentWebView 
        visible={paymentVisible} 
        url={paymentUrl} 
        html={paymentHtml}
        onCancel={() => { 
            setPaymentVisible(false); 
            updateArchiveStatus(currentTxnId, 'cancelled');
        }} 
        onSuccess={handlePaymentSuccess} 
        onFailure={handlePaymentFailure} 
        onUpdateUpi={handleUpdateMerchantUpi}
      />
      <PaymentStatus 
        visible={statusVisible} 
        status={statusMode} 
        onRetry={() => {
          stopLivePolling();
          setStatusVisible(false);
          initiatePayment();
        }} 
        onCancel={() => {
          stopLivePolling();
          setStatusVisible(false);
        }} 
        onDone={() => {
          stopLivePolling();
          setStatusVisible(false);
        }} 
      />

      {/* Ride Receipt / Confirmation Modal Screen */}
      <RideReceiptModal
        visible={receiptModalVisible}
        receipt={confirmedReceipt}
        onDone={() => setReceiptModalVisible(false)}
        onReprint={async (rec) => {
          if (rec) {
            await executePrintAndSync(
              rec.id,
              rec.paymentMode,
              rec.items,
              rec.mobile
            );
          }
        }}
        isPrinting={isPrintingState}
        btStatus={btStatus}
      />
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getUser().then(u => { if (u) setUser(u); setLoading(false); });
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0084c2" /></View>;
  return <SafeAreaProvider>{user ? <MainApp user={user} onLogout={async () => { await storage.clear(); setUser(null); }} /> : <Login onLoginSuccess={setUser} />}</SafeAreaProvider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#0f172a', paddingHorizontal: 15, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 35, height: 35, borderRadius: 8, marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  btIndicator: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, marginRight: 10 },
  btText: { color: '#fff', fontSize: 7, fontWeight: 'bold' },
  adminBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 15 },
  adminLabel: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  testBtn: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 15 },
  testBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  logoutBtn: { padding: 5 },
  body: { flex: 1 },
  leftSide: { flex: 1, padding: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  accent: { width: 4, height: 18, backgroundColor: '#f0c05a', borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1 },
  list: { paddingBottom: 100 },
  rideCard: { backgroundColor: '#fff', borderRadius: 15, margin: 7, elevation: 3, overflow: 'hidden' },
  imageContainer: { width: '100%', height: 160, position: 'relative', backgroundColor: '#1e293b' },
  rideImage: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  imageTextRow: { position: 'absolute', bottom: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 13, fontWeight: '900', color: '#fff', flex: 1, marginRight: 6, textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  priceTag: { backgroundColor: '#f0c05a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  priceTagText: { fontWeight: '900', fontSize: 10, color: '#0f172a' },
  cardFooter: { padding: 10, flex: 1 },
  cardDesc: { fontSize: 10, color: '#64748b', marginBottom: 12 },
  addBtnExact: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plusCircle: { backgroundColor: '#e2e8f0', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  addBtnTextExact: { color: '#475569', fontWeight: 'bold', fontSize: 11 },
  moreCardExact: { borderStyle: 'dashed', borderWidth: 2, borderColor: '#cad5e2', backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  moreIconBox: { backgroundColor: '#fff', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  moreTitle: { fontSize: 14, fontWeight: '900', color: '#64748b' },
  moreSubtitle: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginTop: 4 },
  rightSide: { flex: 1, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e2e8f0' },
  cartContainer: { flex: 1, backgroundColor: '#fff' },
  cartHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cartHeaderText: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: 'bold' },
  cartScroll: { flex: 1, padding: 15 },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  itemName: { fontSize: 13, fontWeight: 'bold' },
  itemPrice: { fontSize: 10, color: '#64748b' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2, marginHorizontal: 10 },
  qtyBtn: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  qtyText: { width: 20, textAlign: 'center', fontWeight: 'bold', fontSize: 11 },
  itemTotal: { fontSize: 13, fontWeight: '900' },
  cartFooterFull: { padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 13 },
  totalBox: { backgroundColor: '#0f172a', borderRadius: 15, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  totalLabel: { fontSize: 8, fontWeight: '900', color: '#f0c05a' },
  totalValLarge: { fontSize: 26, fontWeight: '900', color: '#fff' },
  instantBox: { alignItems: 'flex-end' },
  instantText: { fontSize: 8, color: '#94a3b8' },
  readyText: { fontSize: 10, color: '#10b981', fontWeight: '900' },
  payBtnFull: { backgroundColor: '#0f172a', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  printerCircle: { backgroundColor: '#f0c05a', width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  payBtnTextFull: { color: '#fff', fontWeight: '900', fontSize: 12 },
  fab: { position: 'absolute', right: 20, left: 20, backgroundColor: '#0f172a', padding: 15, borderRadius: 30, alignItems: 'center' },
  fabText: { color: '#fff', fontWeight: 'bold' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#f1f5f9' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', alignItems: 'center' },
  paymentModalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 40, width: '95%', maxWidth: 900, alignItems: 'center' },
  paymentMethodRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 40 },
  paymentMethodBtn: { flex: 1, backgroundColor: '#1e293b', height: 600, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  paymentMethodBtnText: { color: '#000', fontSize: 85, fontWeight: '900', textAlign: 'center' },
  paymentCancelBtn: { marginTop: 25, padding: 15, width: '100%', alignItems: 'center' },
  paymentCancelText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },
});
