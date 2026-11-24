'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import {
  useAddRentTransaction,
  useCreateRazorpayOrder,
  useVerifyRazorpayPayment,
} from '@ott/shared';
import { useStoredUser } from '@/lib/auth';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

type Props = {
  videoId: number;
  videoType: number;
  subVideoType?: number;
  price: number;
  rentDay: number;
  title: string;
  onRented?: () => void;
};

export default function RentButton({
  videoId,
  videoType,
  subVideoType = 0,
  price,
  rentDay,
  title,
  onRented,
}: Props) {
  const router = useRouter();
  const { user } = useStoredUser();
  const createOrder = useCreateRazorpayOrder();
  const addRent = useAddRentTransaction();
  const verifyPayment = useVerifyRazorpayPayment();
  const [error, setError] = useState('');
  const processing = createOrder.isPending || addRent.isPending || verifyPayment.isPending;

  const rent = async () => {
    if (!user?.id) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Rental price is not configured.');
      return;
    }
    if (!window.Razorpay) {
      setError('Payment checkout is still loading. Please try again.');
      return;
    }

    setError('');
    try {
      const transactionRes = await addRent.mutateAsync({
        user_id: user.id,
        video_type: videoType,
        sub_video_type: subVideoType,
        video_id: videoId,
        payment_type: 0,
        transaction_id: '',
      });
      const transaction = Array.isArray(transactionRes.result)
        ? transactionRes.result[0]
        : transactionRes.result;
      const transactionId = (transaction as { id?: number } | undefined)?.id;
      if (!transactionId) throw new Error('Rental transaction was not created.');

      const orderRes = await createOrder.mutateAsync({
        user_id: user.id,
        email: user.email,
        mobile_number: user.mobile_number,
        phone: user.mobile_number,
        name: user.full_name,
        full_name: user.full_name,
        transaction_id: transactionId,
        transaction_type: 'rent',
        content_id: videoId,
        video_id: videoId,
        price: price,
        validity_hours: rentDay * 24,
      });
      const order = orderRes.result as unknown as {
        id: string;
        amount: number;
        currency: string;
        key_id: string;
      };

      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.key_id,
          order_id: order.id,
          amount: order.amount,
          currency: order.currency ?? 'INR',
          name: 'MaxxPixels Rental',
          description: `${title} · ${rentDay} day${rentDay === 1 ? '' : 's'}`,
          prefill: {
            name: user.full_name || '',
            email: user.email || '',
            contact: user.mobile_number || '',
          },
          notes: {
            user_id: String(user.id),
            user_name: user.full_name || '',
            user_email: user.email || '',
            video_id: String(videoId),
            title: title,
            rent_days: String(rentDay),
          },
          theme: {
            color: '#FF6D2E',
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyPayment.mutateAsync({
                user_id: user.id,
                email: user.email,
                transaction_id: transactionId,
                transaction_type: 'rent',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              resolve();
              onRented?.();
              router.refresh();
            } catch (paymentError) {
              reject(paymentError);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        checkout.open();
      });
    } catch (rentError) {
      if (rentError instanceof Error && rentError.message !== 'Payment cancelled') {
        setError(rentError.message || 'Rental payment failed.');
      }
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div>
        <button
          type="button"
          onClick={rent}
          disabled={processing}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-7 text-sm font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.4)] transition hover:brightness-110 disabled:opacity-60 sm:h-12"
        >
          {processing ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
          Rent for ₹{price.toFixed(2)} · {rentDay} day{rentDay === 1 ? '' : 's'}
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-[#FFB088]">{error}</p>}
      </div>
    </>
  );
}
