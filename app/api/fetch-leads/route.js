import { NextResponse } from 'next/server';
import { getAllRestaurants, getRestaurantStats } from '../../lib/restaurantDb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const search = searchParams.get('search');
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      return NextResponse.json(getRestaurantStats());
    }

    let restaurants = getAllRestaurants();

    if (status && status !== 'all' && status !== 'All') {
      restaurants = restaurants.filter((r) => (r.status || 'New Lead').toLowerCase() === status.toLowerCase());
    }

    if (city && city !== 'all') {
      restaurants = restaurants.filter((r) => (r.city || '').toLowerCase() === city.toLowerCase());
    }

    if (state && state !== 'all') {
      restaurants = restaurants.filter((r) => (r.state || '').toLowerCase() === state.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      restaurants = restaurants.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.phone && r.phone.toLowerCase().includes(q)) ||
          (r.city && r.city.toLowerCase().includes(q)) ||
          (r.zip_code && r.zip_code.toLowerCase().includes(q)) ||
          (r.contact_person && r.contact_person.toLowerCase().includes(q))
      );
    }

    return NextResponse.json(restaurants);
  } catch (error) {
    console.error('Error in fetch-leads:', error);
    return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
  }
}