import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const access_key = process.env.UPBIT_ACCESS_KEY;
  const secret_key = process.env.UPBIT_SECRET_KEY;
  const server_url = process.env.UPBIT_SERVER_URL || 'https://api.upbit.com';

  if (!access_key || !secret_key) {
    return NextResponse.json(
      { error: 'API 키가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const payload = {
      access_key: access_key,
      nonce: uuidv4(),
    };

    const token = sign(payload, secret_key);

    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await fetch(`${server_url}/v1/accounts`, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 요청 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Upbit API 오류:', error);
    return NextResponse.json(
      { error: error.message || '계좌 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 