import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { getCheckout, presentCheckout } from '@/lib/checkout';
import { chainById } from '@/config/chains';
import { appMode, isDbConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/SetupNotice';
import { CheckoutView } from '@/components/CheckoutView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) return <SetupNotice />;

  const { id } = await params;
  const checkout = await getCheckout(id);
  if (!checkout) notFound();

  const chain = chainById(checkout.chainId);
  const presentation = await presentCheckout(checkout);

  // Rendered server-side so the QR is in the HTML on first paint — the page is
  // often opened on a phone with a wallet app waiting.
  const qrSvg = await QRCode.toString(presentation.uri, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
  });

  return (
    <CheckoutView
      checkoutId={checkout.id}
      depositAddress={checkout.depositAddress}
      chainName={chain?.name ?? `Chain ${checkout.chainId}`}
      tokenSymbol={checkout.tokenSymbol}
      expectedCents={checkout.expectedCents}
      expiresAt={checkout.expiresAt.toISOString()}
      uri={presentation.uri}
      qrSvg={qrSvg}
      isMockMode={appMode() === 'mock'}
    />
  );
}
