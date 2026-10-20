import { NextResponse } from 'next/server';
import { updateRestaurant } from '../../lib/restaurantDb';

export async function POST(request) {
  try {
    const { id, name, phone, contact_person, city, state, zip_code, full_location, notes } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    if (contact_person !== undefined) updates.contact_person = contact_person.trim();
    if (city !== undefined) updates.city = city.trim();
    if (state !== undefined) updates.state = state.trim();
    if (zip_code !== undefined) updates.zip_code = zip_code.trim();
    if (full_location !== undefined) updates.full_location = full_location.trim();
    if (notes !== undefined) updates.notes = notes;

    const updated = updateRestaurant(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      restaurant: updated,
    });
  } catch (error) {
    console.error('Error updating restaurant info:', error);
    return NextResponse.json(
      { error: 'Failed to update restaurant information' },
      { status: 500 }
    );
  }
}