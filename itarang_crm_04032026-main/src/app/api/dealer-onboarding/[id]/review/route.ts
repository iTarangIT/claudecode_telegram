import { db } from '@/lib/db';
import { accounts, dealerOnboardings } from '@/lib/db/schema';
import { errorResponse, generateId, successResponse, withErrorHandler } from '@/lib/api-utils';
import { requireRole } from '@/lib/auth-utils';
import { eq } from 'drizzle-orm';

export const PATCH = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(['sales_head', 'business_head', 'ceo']);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '').toLowerCase();
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : undefined;

  if (!['approve', 'reject'].includes(action)) {
    return errorResponse('Action must be approve or reject.', 400);
  }

  const [application] = await db
    .select()
    .from(dealerOnboardings)
    .where(eq(dealerOnboardings.id, id))
    .limit(1);

  if (!application) return errorResponse('Dealer onboarding application not found.', 404);

  if (action === 'reject') {
    await db
      .update(dealerOnboardings)
      .set({
        application_status: 'rejected',
        review_notes: notes,
        reviewed_by: user.id,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(dealerOnboardings.id, id));

    return successResponse({ id, status: 'rejected' });
  }

  let accountId = application.account_id;
  if (!accountId) {
    accountId = await generateId('ACC', accounts);
    await db.insert(accounts).values({
      id: accountId,
      business_name: application.business_name,
      owner_name: application.owner_name,
      email: application.email,
      phone: application.phone,
      gstin: application.gstin,
      billing_address: application.address,
      shipping_address: application.address,
      status: 'active',
      created_at: new Date(),
    });
  }

  await db
    .update(dealerOnboardings)
    .set({
      account_id: accountId,
      application_status: 'approved',
      review_notes: notes,
      reviewed_by: user.id,
      reviewed_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(dealerOnboardings.id, id));

  return successResponse({ id, status: 'approved', accountId });
});
