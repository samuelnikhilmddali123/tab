import axios from 'axios';
import { Linking, Platform } from 'react-native';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { API_URL, storage } from './config';

/**
 * Live Production Easebuzz Payment Gateway Service for Rides
 * Handles initiation, portal launch, deep linking, verification, and app resume sync.
 */

export const EASEBUZZ_BASE_PAY_URL = 'https://pay.easebuzz.in/pay/';
export const APP_DEEP_LINK_SCHEME = 'yourrideapp://payment/callback';

/**
 * 1. Initiate Payment Request with Backend
 * Handshake with backend to get live Easebuzz payment_url and txnid.
 *
 * @param {Object} params
 * @param {Array|Object} params.rides - Array of ride cart items or single ride
 * @param {number|string} params.amount - Total fare payable
 * @param {string} [params.customerPhone] - Passenger mobile number
 * @param {string} [params.customerName] - Passenger full name
 * @param {string} [params.customerEmail] - Passenger email address
 * @param {string} [params.txnId] - Pre-generated unique transaction ID (optional)
 * @returns {Promise<{ success: boolean, payment_url: string, access_key?: string, txnid: string, raw: any }>}
 */
export const initiateRidePayment = async ({
  rides = [],
  amount,
  customerPhone = '',
  customerName = 'Passenger',
  customerEmail = 'passenger@ethree.com',
  txnId = null,
}) => {
  const token = await storage.getToken();
  const txnid = txnId || `ETH-${Date.now().toString().slice(-8)}`;

  // Normalize rides data
  const rideList = Array.isArray(rides) ? rides : [rides];
  const rideIds = rideList.map(r => r?.id || r?._id).filter(Boolean);
  const rideDescriptions = rideList
    .map(r => `${r.name || 'Ride'} (x${r.quantity || 1})`)
    .join(', ');

  const formattedAmount = (Number(amount) || 0).toFixed(2);
  const cleanPhone = (customerPhone || '').replace(/\D/g, '') || '9999999999';

  // Request payload formatted for backend Easebuzz initiate endpoint
  const payload = {
    ride_id: rideIds[0] || 'ride_fare',
    ride_ids: rideIds,
    items: rideList,
    amount: formattedAmount,
    txnid: txnid,
    phone: cleanPhone,
    firstname: (customerName || 'Passenger').trim(),
    email: (customerEmail || 'passenger@ethree.com').trim(),
    productinfo: (rideDescriptions || 'Ride Fare Tickets').substring(0, 100),
    surl: `${API_URL}/api/payments/response?status=success&txnid=${txnid}`,
    furl: `${API_URL}/api/payments/response?status=failure&txnid=${txnid}`,
    callback_url: APP_DEEP_LINK_SCHEME,
  };

  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  console.log('[Easebuzz Service] Initiating payment for txnid:', txnid, 'amount: ₹', formattedAmount);

  let response;
  try {
    // 1. Primary backend initiation endpoint
    response = await axios.post(`${API_URL}/api/payments/initiate`, payload, {
      headers,
      timeout: 10000,
    });
  } catch (primaryErr) {
    console.warn('[Easebuzz Service] /api/payments/initiate failed, attempting fallback endpoints:', primaryErr.message);
    try {
      // 2. Secondary endpoint fallback
      response = await axios.post(`${API_URL}/api/payments/easebuzz/initiate`, payload, {
        headers,
        timeout: 10000,
      });
    } catch (secondaryErr) {
      // 3. Third endpoint fallback
      response = await axios.post(`${API_URL}/api/rides/payment/initiate`, payload, {
        headers,
        timeout: 10000,
      });
    }
  }

  const responseData = response?.data?.data || response?.data || {};

  // Extract payment_url, access_key, and txnid
  let paymentUrl =
    responseData.payment_url ||
    responseData.paymentUrl ||
    responseData.url ||
    responseData.redirect_url;
  const accessKey =
    responseData.access_key ||
    responseData.accessKey ||
    responseData.key;
  const returnedTxnId =
    responseData.txnid ||
    responseData.txnId ||
    responseData.transaction_id ||
    txnid;

  // Construct official Easebuzz checkout URL if only access_key is provided
  if (!paymentUrl && accessKey) {
    paymentUrl = `${EASEBUZZ_BASE_PAY_URL}${accessKey}`;
  }

  if (!paymentUrl) {
    throw new Error('Backend failed to return a valid Easebuzz payment_url or access_key.');
  }

  console.log('[Easebuzz Service] Payment initiated successfully. Gateway URL:', paymentUrl);

  return {
    success: true,
    payment_url: paymentUrl,
    access_key: accessKey,
    txnid: returnedTxnId,
    raw: response.data,
  };
};

/**
 * 2. Launch Live Easebuzz Portal
 * Opens payment_url in Chrome Custom Tabs (Android) or SFSafariViewController (iOS),
 * with automatic fallback to Linking.openURL.
 *
 * @param {string} paymentUrl - The Easebuzz live checkout URL
 * @returns {Promise<{ type: string }>}
 */
export const launchEasebuzzPortal = async (paymentUrl) => {
  if (!paymentUrl) {
    throw new Error('Cannot launch portal: paymentUrl is missing.');
  }

  console.log('[Easebuzz Service] Launching portal in InAppBrowser:', paymentUrl);

  try {
    const isAvailable = await InAppBrowser.isAvailable();
    if (isAvailable) {
      const result = await InAppBrowser.open(paymentUrl, {
        // iOS SFSafariViewController Properties
        dismissButtonStyle: 'cancel',
        preferredBarTintColor: '#0f172a',
        preferredControlTintColor: '#f0c05a',
        readerMode: false,
        animated: true,
        modalPresentationStyle: 'fullScreen',
        modalTransitionStyle: 'coverVertical',
        modalEnabled: true,
        enableBarCollapsing: false,

        // Android Chrome Custom Tabs Properties
        showTitle: true,
        toolbarColor: '#0f172a',
        secondaryToolbarColor: '#1e293b',
        navigationBarColor: '#0f172a',
        navigationBarDividerColor: '#1e293b',
        enableUrlBarHiding: true,
        enableDefaultShare: false,
        forceCloseOnRedirection: true,
        showInRecents: true,
        animations: {
          startEnter: 'slide_in_right',
          startExit: 'slide_out_left',
          endEnter: 'slide_in_left',
          endExit: 'slide_out_right',
        },
      });
      return result;
    } else {
      console.log('[Easebuzz Service] InAppBrowser not available, falling back to Linking.openURL');
      await Linking.openURL(paymentUrl);
      return { type: 'opened_external' };
    }
  } catch (err) {
    console.warn('[Easebuzz Service] InAppBrowser open failed, falling back to Linking.openURL:', err.message);
    await Linking.openURL(paymentUrl);
    return { type: 'fallback_linking' };
  }
};

/**
 * Dismiss the In-App Browser / Custom Tab
 */
export const dismissEasebuzzPortal = async () => {
  try {
    const isAvailable = await InAppBrowser.isAvailable();
    if (isAvailable) {
      InAppBrowser.close();
      console.log('[Easebuzz Service] InAppBrowser dismissed successfully.');
    }
  } catch (err) {
    console.warn('[Easebuzz Service] Failed to dismiss InAppBrowser:', err.message);
  }
};

/**
 * 3. Deep Link Parser
 * Parses status and txnid from query parameters of deep link callback
 * E.g.: yourrideapp://payment/callback?status=success&txnid=ETH-12345678
 *
 * @param {string} url - Deep link URL
 * @returns {{ isPaymentCallback: boolean, status: 'success'|'failure'|'cancelled'|'pending', txnid: string, params: Object, rawUrl: string }}
 */
export const parseDeepLinkUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { isPaymentCallback: false, status: null, txnid: null, params: {}, rawUrl: url };
  }

  const isCallback =
    url.includes('payment/callback') ||
    url.includes('yourrideapp://') ||
    url.includes('payment-success') ||
    url.includes('payment-failure') ||
    url.includes('status=');

  const [baseUrl, queryString] = url.split('?');
  const params = {};

  if (queryString) {
    const queryParts = queryString.split('&');
    for (const part of queryParts) {
      const [rawKey, rawVal] = part.split('=');
      if (rawKey) {
        const key = decodeURIComponent(rawKey).trim();
        const val = decodeURIComponent(rawVal || '').trim();
        params[key] = val;
      }
    }
  }

  // Derive status
  let status = null;
  const rawStatus = (params.status || params.payment_status || '').toLowerCase();

  if (
    rawStatus === 'success' ||
    rawStatus === 'successful' ||
    rawStatus === 'paid' ||
    url.includes('payment-success') ||
    url.includes('status=success')
  ) {
    status = 'success';
  } else if (
    rawStatus === 'failure' ||
    rawStatus === 'failed' ||
    rawStatus === 'bounced' ||
    rawStatus === 'cancelled' ||
    url.includes('payment-failure') ||
    url.includes('status=failure')
  ) {
    status = rawStatus === 'cancelled' ? 'cancelled' : 'failure';
  } else if (rawStatus) {
    status = rawStatus;
  }

  // Derive txnid
  const txnid =
    params.txnid ||
    params.txnId ||
    params.transaction_id ||
    params.easebuzzid ||
    params.reference_id ||
    null;

  return {
    isPaymentCallback: isCallback,
    status: status,
    txnid: txnid,
    params: params,
    baseUrl: baseUrl,
    rawUrl: url,
  };
};

/**
 * 4. Verify Payment Status with Backend
 * Calls backend verification endpoint for txnid to confirm database synchronization.
 *
 * @param {string} txnid - Transaction ID
 * @returns {Promise<{ verified: boolean, failed: boolean, status: string, data: any }>}
 */
export const verifyPaymentStatus = async (txnid) => {
  if (!txnid) {
    return { verified: false, failed: false, status: 'missing_txnid', data: null };
  }

  const token = await storage.getToken();
  const headers = {
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  console.log('[Easebuzz Service] Verifying transaction status on backend for txnid:', txnid);

  let response;
  // 1. Try GET /api/payments/verify/:txnid
  try {
    response = await axios.get(`${API_URL}/api/payments/verify/${txnid}`, {
      headers,
      timeout: 8000,
    });
  } catch (err1) {
    // 2. Try GET /api/payments/status/:txnid
    try {
      response = await axios.get(`${API_URL}/api/payments/status/${txnid}`, {
        headers,
        timeout: 8000,
      });
    } catch (err2) {
      // 3. Try POST /api/payments/verify with body { txnid }
      try {
        response = await axios.post(
          `${API_URL}/api/payments/verify`,
          { txnid },
          { headers, timeout: 8000 }
        );
      } catch (err3) {
        console.warn('[Easebuzz Service] All verification endpoints failed for txnid:', txnid, err3.message);
        return {
          verified: false,
          failed: false,
          status: 'network_error',
          error: err3.message,
          data: null,
        };
      }
    }
  }

  const resData = response?.data?.data || response?.data || {};
  const statusStr = (
    resData.status ||
    resData.payment_status ||
    resData.result ||
    (response?.data?.success === true ? 'success' : '') ||
    ''
  ).toString().toLowerCase();

  const isVerified =
    statusStr === 'success' ||
    statusStr === 'paid' ||
    statusStr === 'completed' ||
    statusStr === 'successful' ||
    resData.isPaid === true ||
    response?.data?.isPaid === true ||
    response?.data?.success === true;

  const isFailed =
    statusStr === 'failure' ||
    statusStr === 'failed' ||
    statusStr === 'bounced' ||
    statusStr === 'cancelled' ||
    response?.data?.success === false;

  console.log('[Easebuzz Service] Backend verification response:', { isVerified, statusStr, txnid });

  return {
    verified: isVerified,
    failed: isFailed,
    status: isVerified ? 'success' : isFailed ? 'failure' : statusStr || 'pending',
    data: resData,
  };
};

/**
 * 5. App Lifecycle Resume Poller (Fallback Verification)
 * Polls backend status API for txnid with short interval if passenger switches back to app.
 *
 * @param {string} txnid
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=4]
 * @param {number} [options.delayMs=2000]
 * @returns {Promise<{ verified: boolean, failed: boolean, status: string, data: any }>}
 */
export const pollPaymentStatus = async (txnid, { maxAttempts = 4, delayMs = 2000 } = {}) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Easebuzz Service] Polling attempt ${attempt}/${maxAttempts} for ${txnid}`);
    const result = await verifyPaymentStatus(txnid);
    if (result.verified || result.failed) {
      return result;
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return { verified: false, failed: false, status: 'timeout', data: null };
};

export default {
  initiateRidePayment,
  launchEasebuzzPortal,
  dismissEasebuzzPortal,
  parseDeepLinkUrl,
  verifyPaymentStatus,
  pollPaymentStatus,
  APP_DEEP_LINK_SCHEME,
  EASEBUZZ_BASE_PAY_URL,
};

