import { getLockoutStatus } from '@/lib/lockout';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || '';

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const clientIp = ip ? ip.split(',')[0].trim() : 'unknown';

    const lockout = await getLockoutStatus(username, clientIp);

    return NextResponse.json({
      success: true,
      locked: lockout.locked,
      remainingSeconds: lockout.remainingSeconds,
      reason: lockout.reason,
      type: lockout.type
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
