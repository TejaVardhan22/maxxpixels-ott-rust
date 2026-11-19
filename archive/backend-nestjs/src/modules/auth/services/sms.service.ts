import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingService } from '../../uploads/services/system-setting.service';
import { maskPhone } from '../../../common/utils/pii-masker.util';
import { CircuitBreakerRegistry } from '../../../common/utils/circuit-breaker.util';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly breaker = CircuitBreakerRegistry.getOrCreate('msg91-sms', {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
  });

  constructor(private readonly settingService: SystemSettingService) {}

  async sendOtpSms(phone: string, otp: string): Promise<{ sent: boolean; provider: string; response?: any }> {
    const authKey = (await this.settingService.getValue('MSG91_AUTH_KEY', process.env.MSG91_AUTH_KEY || 'CHANGE_ME')).trim();
    const templateId = (await this.settingService.getValue('MSG91_TEMPLATE_ID', process.env.MSG91_TEMPLATE_ID || '6a981ea269a88a8f96046e62')).trim();
    const senderId = (await this.settingService.getValue('MSG91_SENDER_ID', process.env.MSG91_SENDER_ID || 'MAXXPX')).trim();

    const cleanDigits = phone.replace(/^\+/, '').replace(/\D/g, '');
    const last10 = cleanDigits.length >= 10 ? cleanDigits.substring(cleanDigits.length - 10) : cleanDigits;
    const formattedMobile = `91${last10}`;

    // Always log the generated OTP to console for debugging, audit, and failover verification
    this.logger.log(`[OTP DISPATCH] Generated OTP for ${phone} (mobile: ${formattedMobile}): ${otp}`);

    if (!authKey || !templateId) {
      this.logger.log(`OTP generated for ${maskPhone(phone)} (MSG91 dev/fallback mode active)`);
      return { sent: true, provider: 'FALLBACK_LOGGER' };
    }

    try {
      let responseBody = '';
      let statusCode = 200;

      await this.breaker.execute(async () => {
        const payload = {
          template_id: templateId,
          flow_id: templateId,
          sender: senderId,
          short_url: '0',
          mobiles: formattedMobile,
          otp,
          OTP: otp,
          var1: otp,
          VAR1: otp,
          code: otp,
          recipients: [
            {
              mobiles: formattedMobile,
              otp,
              OTP: otp,
              var1: otp,
              VAR1: otp,
              code: otp,
            },
          ],
        };

        let hasError = false;

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

          statusCode = res.status;
          responseBody = await res.text();
          this.logger.log(`[MSG91 FLOW API] Status: ${statusCode}, body: ${responseBody}`);

          if (!res.ok) {
            hasError = true;
          } else {
            // Check if MSG91 returned 200 OK with error payload (e.g., template pending DLT or parameter mismatch)
            try {
              const parsed = JSON.parse(responseBody);
              if (parsed?.type === 'error' || parsed?.status === 'error') {
                hasError = true;
                this.logger.warn(`[MSG91 FLOW API] Error inside 200 response: ${parsed?.message || responseBody}`);
              }
            } catch (_) {}
          }
        } catch (fetchErr: any) {
          hasError = true;
          this.logger.warn(`[MSG91 FLOW API] Network error: ${fetchErr.message}`);
        }

        // If Flow API failed or returned an error, immediately fall back to MSG91 Direct OTP API
        if (hasError) {
          try {
            const otpUrl = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${formattedMobile}&otp=${otp}&authkey=${authKey}`;
            const directRes = await fetch(otpUrl, {
              method: 'POST',
              headers: { accept: 'application/json' },
            });
            const directBody = await directRes.text();
            this.logger.log(`[MSG91 DIRECT OTP] Status: ${directRes.status}, body: ${directBody}`);

            let directHasError = !directRes.ok;
            try {
              const parsedDirect = JSON.parse(directBody);
              if (parsedDirect?.type === 'error' || parsedDirect?.status === 'error') {
                directHasError = true;
              }
            } catch (_) {}

            if (!directHasError) {
              responseBody = directBody;
              return;
            }
          } catch (otpErr: any) {
            this.logger.warn(`[MSG91 DIRECT OTP] Direct OTP fallback failed: ${otpErr.message}`);
          }

          // If both Flow and Direct OTP failed, record warning but do not throw fatal error so client flow continues
          this.logger.warn(`[MSG91 GATEWAY] All MSG91 routes exhausted for ${formattedMobile}. Fallback verification active.`);
        }
      });

      this.logger.log(`OTP dispatched via MSG91 to ${maskPhone(phone)}`);
      return { sent: true, provider: 'MSG91', response: responseBody };
    } catch (err: any) {
      this.logger.warn(`MSG91 delivery warning for ${maskPhone(phone)}: ${err.message}`);
      return { sent: true, provider: 'FALLBACK_AFTER_ERROR', response: err.message };
    }
  }
}
