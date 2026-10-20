import { NextResponse } from 'next/server';
import { updateRestaurant } from '../../lib/restaurantDb';
import { getAgent } from '../../lib/agentIdentity';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      id,
      status,
      notes,
      attempts,
      callbackDate,
      contactPerson,
      incrementAttempts = true,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 });
    }

    const agent = await getAgent();
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const updates = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (callbackDate !== undefined) updates.callback_date = callbackDate;
    if (contactPerson !== undefined) updates.contact_person = contactPerson;

    updates.last_called = `${timestamp}${agent?.name ? ` by ${agent.name}` : ''}`;

    if (attempts !== undefined) {
      updates.attempts = Number(attempts);
    } else if (incrementAttempts) {
      // Auto increment attempts on contact update
      updates.attempts = (Number(body.currentAttempts) || 0) + 1;
    }

    const updated = updateRestaurant(id, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      restaurant: updated,
    });
  } catch (error) {
    console.error('Error updating restaurant status:', error);
    return NextResponse.json(
      { error: 'Failed to update restaurant status' },
      { status: 500 }
    );
  }
}