import { NextResponse } from 'next/server';
import { addRestaurant, getAllRestaurants } from '../../lib/restaurantDb';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, city, state, zip_code, address, listing_url, contact_person, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Clean phone for duplicate check
    const cleanPhone = phone.replace(/\D/g, '');
    const existing = getAllRestaurants();
    const isDuplicate = existing.some((r) => (r.phone || '').replace(/\D/g, '') === cleanPhone);

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'A restaurant with this phone number already exists in the system.' },
        { status: 409 }
      );
    }

    const newRestaurant = addRestaurant({
      name,
      phone,
      city,
      state,
      zip_code,
      full_location: address || `${city || ''}, ${state || ''} ${zip_code || ''}, United States`.trim(),
      listing_url,
      contact_person,
      notes,
      status: 'New Lead',
    });

    return NextResponse.json({
      success: true,
      restaurant: newRestaurant,
    });
  } catch (error) {
    console.error('Error in submit-lead:', error);
    return NextResponse.json(
      { error: 'Failed to submit restaurant lead' },
      { status: 500 }
    );
  }
}