/**
 * Generates interactive Payment Gateway HTML for PaymentWebView
 * Automatically handles success & failure redirects for hands-free detection.
 */
export function generateGatewayHtml({ amount, txnId, mobile, merchantUpi = '7036923456@ybl', apiBaseUrl = 'https://swampland-situated-barbell.ngrok-free.dev' }) {
  const formattedAmount = (Number(amount) || 0).toFixed(2);
  const cleanUpi = (merchantUpi || '7036923456@ybl').trim();
  const upiIntentUri = `upi://pay?pa=${cleanUpi}&pn=ETHREE%20ENTERTAINMENT&am=${formattedAmount}&cu=INR&tn=ETHREE%20Tickets`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiIntentUri)}&margin=10&format=png`;

  const successRedirect = `${apiBaseUrl}/api/payments/response?status=success&txnid=${encodeURIComponent(txnId || '')}`;
  const failureRedirect = `${apiBaseUrl}/api/payments/response?status=failure&txnid=${encodeURIComponent(txnId || '')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ETHREE Secure Payment</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 16px; position: relative; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; width: 100%; max-width: 480px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); position: relative; }
    .header { background: #0b1120; padding: 16px 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 32px; height: 32px; background: #f59e0b; border-radius: 8px; display: flex; justify-content: center; align-items: center; font-weight: 900; color: #000; font-size: 14px; }
    .brand-name { font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 0.5px; }
    .brand-sub { font-size: 10px; color: #94a3b8; }
    .secure-badge { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 8px; border-radius: 20px; font-size: 10px; font-weight: bold; color: #34d399; display: flex; align-items: center; gap: 4px; }
    .body { padding: 20px; text-align: center; }
    .amount-box { background: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 12px; margin-bottom: 16px; }
    .amount-label { font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    .amount-val { font-size: 32px; font-weight: 900; color: #f59e0b; margin-top: 4px; }
    .qr-frame { background: #ffffff; padding: 14px; border-radius: 16px; display: inline-block; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); margin-bottom: 12px; }
    .qr-img { width: 200px; height: 200px; display: block; border-radius: 8px; }
    .scan-tip { font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; }
    .scan-sub { font-size: 11px; color: #64748b; margin-bottom: 14px; }
    .apps-row { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .app-pill { background: #0f172a; border: 1px solid #334155; border-radius: 20px; padding: 4px 10px; font-size: 10px; font-weight: bold; color: #cbd5e1; }
    .meta-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 8px 0; border-top: 1px solid #334155; color: #94a3b8; }
    .meta-val { color: #f8fafc; font-weight: bold; }
    .vpa-wrapper { display: flex; align-items: center; gap: 6px; }
    .vpa-val { color: #38bdf8; font-weight: bold; font-family: monospace; font-size: 12px; }
    .edit-btn { background: #0284c7; color: #fff; border: none; border-radius: 6px; padding: 2px 7px; font-size: 10px; font-weight: bold; cursor: pointer; }
    .timer-bar { height: 4px; background: #334155; border-radius: 2px; overflow: hidden; margin-top: 14px; margin-bottom: 8px; }
    .timer-fill { height: 100%; background: #3b82f6; width: 100%; transition: width 1s linear; }
    .timer-text { font-size: 10px; color: #64748b; font-weight: 600; }
    .actions { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; }
    .auto-detect-box { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .pulse-dot { width: 8px; height: 8px; background: #38bdf8; border-radius: 50%; box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } }
    .auto-detect-text { font-size: 11px; font-weight: bold; color: #38bdf8; }
    .complete-btn { background: #10b981; color: #fff; border: none; border-radius: 12px; padding: 12px; font-size: 13px; font-weight: 900; cursor: pointer; letter-spacing: 0.5px; transition: background 0.2s; display: flex; justify-content: center; align-items: center; gap: 6px; }
    .complete-btn:hover { background: #059669; }
    .cancel-btn { background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 12px; padding: 10px; font-size: 11px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
    .cancel-btn:hover { background: #334155; color: #ef4444; }

    /* Custom In-Page Modal for UPI Editing */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); z-index: 9999; justify-content: center; align-items: center; padding: 20px; }
    .modal-box { background: #1e293b; border: 2px solid #38bdf8; border-radius: 16px; width: 100%; max-width: 400px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); text-align: left; }
    .modal-title { font-size: 16px; font-weight: 900; color: #fff; margin-bottom: 6px; }
    .modal-desc { font-size: 12px; color: #94a3b8; margin-bottom: 14px; line-height: 1.4; }
    .upi-input { width: 100%; background: #0f172a; border: 1px solid #475569; border-radius: 10px; padding: 12px; color: #fff; font-size: 14px; font-weight: bold; margin-bottom: 12px; outline: none; }
    .upi-input:focus { border-color: #38bdf8; }
    .chips-label { font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 6px; }
    .chips-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .chip { background: #334155; color: #cbd5e1; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: bold; cursor: pointer; }
    .chip:hover { background: #475569; color: #fff; }
    .modal-btn-row { display: flex; gap: 10px; }
    .modal-save-btn { flex: 1; background: #10b981; color: #fff; border: none; border-radius: 10px; padding: 12px; font-size: 13px; font-weight: 900; cursor: pointer; }
    .modal-close-btn { flex: 1; background: #334155; color: #cbd5e1; border: none; border-radius: 10px; padding: 12px; font-size: 13px; font-weight: bold; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">E3</div>
        <div>
          <div class="brand-name">ETHREE ENTERTAINMENT</div>
          <div class="brand-sub">Unified Payments Interface (UPI)</div>
        </div>
      </div>
      <div class="secure-badge">
        <span>🔒</span> Verified
      </div>
    </div>

    <div class="body">
      <div class="amount-box">
        <div class="amount-label">Total Amount Payable</div>
        <div class="amount-val">₹${formattedAmount}</div>
      </div>

      <div class="qr-frame">
        <img class="qr-img" id="qrImg" src="${qrUrl}" alt="UPI QR Code" />
      </div>

      <div class="scan-tip">Scan QR Code with Any UPI App</div>
      <div class="scan-sub">Payment will be automatically detected</div>

      <div class="apps-row">
        <div class="app-pill">Google Pay</div>
        <div class="app-pill">PhonePe</div>
        <div class="app-pill">Paytm</div>
        <div class="app-pill">BHIM</div>
        <div class="app-pill">Cred</div>
      </div>

      <div class="meta-row">
        <span>Transaction ID:</span>
        <span class="meta-val">${txnId || 'ETH-PENDING'}</span>
      </div>
      <div class="meta-row">
        <span>Merchant UPI ID:</span>
        <div class="vpa-wrapper">
          <span class="vpa-val" id="vpaDisplay">${cleanUpi}</span>
          <button class="edit-btn" onclick="openUpiModal()">Edit</button>
        </div>
      </div>
      ${mobile ? `<div class="meta-row"><span>Customer Mobile:</span><span class="meta-val">+91 ${mobile}</span></div>` : ''}

      <div class="timer-bar">
        <div class="timer-fill" id="timerFill"></div>
      </div>
      <div class="timer-text" id="timerText">QR Valid for 05:00</div>

      <div class="actions">
        <div class="auto-detect-box">
          <div class="pulse-dot"></div>
          <span class="auto-detect-text">Waiting for payment confirmation...</span>
        </div>

        <button class="complete-btn" onclick="triggerSuccess()">
          <span>✓</span> Payment Completed
        </button>

        <button class="cancel-btn" onclick="triggerFailure()">
          Cancel Transaction
        </button>
      </div>
    </div>
  </div>

  <!-- In-Page UPI Editing Modal -->
  <div class="modal-overlay" id="upiModalOverlay">
    <div class="modal-box">
      <div class="modal-title">Configure Merchant UPI ID</div>
      <div class="modal-desc">Enter your registered UPI ID (VPA) from PhonePe, Google Pay, or Paytm to receive payments directly.</div>
      <input type="text" class="upi-input" id="upiInput" value="${cleanUpi}" placeholder="e.g. yourname@ibl or 9876543210@paytm" />
      
      <div class="chips-label">Quick Suffixes:</div>
      <div class="chips-row">
        <button class="chip" onclick="setSuffix('@ibl')">@ibl (PhonePe)</button>
        <button class="chip" onclick="setSuffix('@axl')">@axl (PhonePe)</button>
        <button class="chip" onclick="setSuffix('@ybl')">@ybl (PhonePe)</button>
        <button class="chip" onclick="setSuffix('@paytm')">@paytm</button>
        <button class="chip" onclick="setSuffix('@okaxis')">@okaxis (GPay)</button>
        <button class="chip" onclick="setSuffix('@okhdfcbank')">@okhdfcbank</button>
      </div>

      <div class="modal-btn-row">
        <button class="modal-save-btn" onclick="saveUpiModal()">Save & Update QR</button>
        <button class="modal-close-btn" onclick="closeUpiModal()">Cancel</button>
      </div>
    </div>
  </div>

  <script>
    const txnId = "${txnId || ''}";
    const successUrl = "${successRedirect}";
    const failureUrl = "${failureRedirect}";
    const amountVal = "${formattedAmount}";
    let currentMerchantUpi = "${cleanUpi}";

    // Check if previously saved in localStorage
    try {
      const saved = localStorage.getItem('saved_merchant_upi');
      if (saved && saved.includes('@') && saved !== currentMerchantUpi) {
        currentMerchantUpi = saved;
        document.getElementById('vpaDisplay').innerText = currentMerchantUpi;
        document.getElementById('upiInput').value = currentMerchantUpi;
        refreshQrCode();
      }
    } catch(e) {}

    function notifyNative(type, extra) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type, txnId: txnId }, extra || {})));
      }
    }

    function openUpiModal() {
      document.getElementById('upiInput').value = currentMerchantUpi;
      document.getElementById('upiModalOverlay').style.display = 'flex';
    }

    function closeUpiModal() {
      document.getElementById('upiModalOverlay').style.display = 'none';
    }

    function setSuffix(suffix) {
      const input = document.getElementById('upiInput');
      let val = input.value.trim();
      if (val.includes('@')) {
        val = val.split('@')[0];
      }
      input.value = (val || '7036923456') + suffix;
    }

    function refreshQrCode() {
      const clean = currentMerchantUpi.trim();
      const newUri = 'upi://pay?pa=' + clean + '&pn=ETHREE%20ENTERTAINMENT&am=' + encodeURIComponent(amountVal) + '&cu=INR&tn=ETHREE%20Tickets';
      document.getElementById('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(newUri) + '&margin=10&format=png';
    }

    function saveUpiModal() {
      const entered = document.getElementById('upiInput').value.trim();
      if (entered && entered.includes('@')) {
        currentMerchantUpi = entered;
        document.getElementById('vpaDisplay').innerText = currentMerchantUpi;
        refreshQrCode();
        try { localStorage.setItem('saved_merchant_upi', currentMerchantUpi); } catch(e) {}
        notifyNative('UPDATE_UPI', { upiId: currentMerchantUpi });
        closeUpiModal();
      } else {
        alert('Please enter a valid UPI ID containing "@" (e.g. 7036923456@ibl)');
      }
    }

    function triggerSuccess() {
      notifyNative('SUCCESS');
      window.location.href = successUrl;
    }

    function triggerFailure() {
      notifyNative('FAILURE');
      window.location.href = failureUrl;
    }

    // 5-Minute Expiry Countdown
    let totalSeconds = 300;
    const initialSeconds = totalSeconds;
    const timerFill = document.getElementById('timerFill');
    const timerText = document.getElementById('timerText');

    const countdown = setInterval(() => {
      totalSeconds--;
      if (totalSeconds <= 0) {
        clearInterval(countdown);
        triggerFailure();
        return;
      }
      const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
      const secs = String(totalSeconds % 60).padStart(2, '0');
      timerText.textContent = 'QR Valid for ' + mins + ':' + secs;
      timerFill.style.width = ((totalSeconds / initialSeconds) * 100) + '%';
    }, 1000);
  </script>
</body>
</html>`;
}
