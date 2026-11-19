/**
 * Standalone Test Script for MSG91 SMS OTP Dispatch
 * Usage: node test-send-otp.js <phone_number>
 * Example: node test-send-otp.js 9876543210
 */

const authKey = process.env.MSG91_AUTH_KEY || 'CHANGE_ME';
const templateId = process.env.MSG91_TEMPLATE_ID || '6a981ea269a88a8f96046e62';
const senderId = process.env.MSG91_SENDER_ID || 'MAXXPX';

const targetPhone = process.argv[2] || '9876543210';
const cleanDigits = targetPhone.replace(/^\+/, '').replace(/\D/g, '');
const last10 = cleanDigits.length >= 10 ? cleanDigits.substring(cleanDigits.length - 10) : cleanDigits;
const formattedMobile = `91${last10}`;

const otp = String(Math.floor(100000 + Math.random() * 900000));

console.log('====================================================');
console.log(' MaxxPixels OTT — NestJS MSG91 SMS OTP Test Runner');
console.log('====================================================');
console.log(`Target Phone:      +${formattedMobile}`);
console.log(`Generated OTP:     ${otp}`);
console.log(`Auth Key:          ${authKey.substring(0, 8)}...`);
console.log(`Template/Flow ID:  ${templateId}`);
console.log(`Sender ID:         ${senderId}`);
console.log('----------------------------------------------------');

async function runTest() {
  const payload = {
    template_id: templateId,
    flow_id: templateId,
    sender: senderId,
    short_url: '0',
    mobiles: formattedMobile,
    otp: otp,
    OTP: otp,
    var1: otp,
    VAR1: otp,
    code: otp,
    recipients: [
      {
        mobiles: formattedMobile,
        otp: otp,
        OTP: otp,
        var1: otp,
        VAR1: otp,
        code: otp,
      },
    ],
  };

  console.log('Sending request to https://control.msg91.com/api/v5/flow/ ...');
  try {
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await res.text();
    console.log(`Response Status:   ${res.status} ${res.statusText}`);
    console.log(`Response Body:     ${bodyText}`);

    if (res.ok) {
      console.log('\n[SUCCESS] MSG91 Gateway accepted the OTP SMS dispatch request.');
      return;
    }

    console.log('\n[NOTICE] Flow API returned non-200. Attempting direct OTP API fallback...');
    const otpUrl = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${formattedMobile}&otp=${otp}&authkey=${authKey}`;
    const directRes = await fetch(otpUrl, {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    const directBody = await directRes.text();
    console.log(`Direct OTP Status: ${directRes.status} ${directRes.statusText}`);
    console.log(`Direct OTP Body:   ${directBody}`);

    if (directRes.ok) {
      console.log('\n[SUCCESS] Direct OTP endpoint successfully dispatched the SMS.');
    } else {
      console.log('\n[WARNING] Please verify template approval & DLT registration on your MSG91 control panel.');
    }
  } catch (err) {
    console.error('[ERROR] Network request failed:', err.message);
  }
}

runTest();

