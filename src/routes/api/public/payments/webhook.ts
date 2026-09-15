import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, EventName, type PaddleEnv } from '@/lib/paddle.server';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  if (!userId) {
    console.error('No userId in customData');
    return;
  }

  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.price?.productId;
  if (!priceId) {
    console.warn('Skipping purchase: missing importMeta.externalId', { rawPriceId: item?.price?.id });
    return;
  }

  await getSupabase()
    .from('purchases')
    .upsert(
      {
        user_id: userId,
        paddle_transaction_id: data.id,
        paddle_customer_id: data.customerId ?? null,
        product_id: productId ?? 'funnel_preflight_unlock',
        price_id: priceId,
        status: 'completed',
        environment: env,
      },
      { onConflict: 'paddle_transaction_id' },
    );
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    default:
      console.log('Unhandled event:', event.eventType);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error('Webhook error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
