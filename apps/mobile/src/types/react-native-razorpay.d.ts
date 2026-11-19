declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    description?: string;
    image?: string;
    currency: string;
    key: string;
    amount: number | string;
    name: string;
    order_id: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
      [key: string]: any;
    };
    theme?: {
      color?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    [key: string]: any;
  }

  export interface RazorpayErrorResponse {
    code?: number;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: any;
    [key: string]: any;
  }

  export default class RazorpayCheckout {
    static open(
      options: RazorpayOptions,
      successCallback?: (data: RazorpaySuccessResponse) => void,
      errorCallback?: (error: RazorpayErrorResponse) => void
    ): Promise<RazorpaySuccessResponse>;

    static onExternalWalletSelection(
      externalWalletCallback: (data: any) => void
    ): void;
  }
}
