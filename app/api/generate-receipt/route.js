import { NextResponse } from 'next/server';

const RECEIPT_BACKEND_URL = 'https://payslips-bootcamp1-19de08d23749.herokuapp.com/generate-receipt';

export async function POST(request) {
  try {
    const incomingFormData = await request.formData();

    const outgoingFormData = new FormData();
    outgoingFormData.append('name', incomingFormData.get('name') || '');
    outgoingFormData.append('amount', incomingFormData.get('amount') || '');
    outgoingFormData.append('email', incomingFormData.get('email') || '');

    const upstreamResponse = await fetch(RECEIPT_BACKEND_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.RECEIPT_API_KEY || '',
      },
      body: outgoingFormData,
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to generate receipt' },
        { status: upstreamResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error proxying receipt generation:', error);
    return NextResponse.json(
      { error: 'Failed to reach invoicing backend' },
      { status: 500 }
    );
  }
}
