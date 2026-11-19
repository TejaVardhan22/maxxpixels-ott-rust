import { Injectable, NotFoundException } from '@nestjs/common';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import { RazorpayGateway } from './razorpay.gateway';

@Injectable()
export class PaymentGatewayFactory {
  private readonly gateways = new Map<string, IPaymentGateway>();

  constructor(private readonly razorpayGateway: RazorpayGateway) {
    this.register(razorpayGateway);
  }

  register(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.providerCode.toUpperCase(), gateway);
  }

  getGateway(providerCode = 'RAZORPAY'): IPaymentGateway {
    const code = providerCode.toUpperCase().trim();
    const gateway = this.gateways.get(code) || this.gateways.get('RAZORPAY');
    if (!gateway) {
      throw new NotFoundException(`Payment gateway provider '${providerCode}' is not supported.`);
    }
    return gateway;
  }
}

