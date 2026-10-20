import { NextResponse } from 'next/server';
import { createSessionToken, COOKIE_NAME, getExpectedCredentials } from '../../../lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    const expected = getExpectedCredentials();

    if (!expected.email || !expected.password) {
      return NextResponse.json(
        { error: 'Server authentication is not configured in .env' },
        { status: 500 }
      );
    }

    const inputEmail = (email || '').trim().toLowerCase();
    const expectedEmail = expected.email.trim().toLowerCase();
    const inputPassword = (password || '').trim();
    const expectedPassword = expected.password.trim();

    if (inputEmail !== expectedEmail || inputPassword !== expectedPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = await createSessionToken(expected.email);

    const response = NextResponse.json({
      success: true,
      user: { email: expected.email },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
