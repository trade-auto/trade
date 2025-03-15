import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import querystring from 'querystring';

export async function POST(request: Request) {
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
    const body = await request.json();
    const queryParams = querystring.unescape(querystring.encode(body));

    // 쿼리 해시 생성
    const hash = crypto.createHash('sha512');
    const queryHash = hash.update(queryParams, 'utf-8').digest('hex');

    // JWT 페이로드 구성
    const payload = {
      access_key,
      nonce: uuidv4(),
      query_hash: queryHash,
      query_hash_alg: 'SHA512',
    };

    const token = sign(payload, secret_key);

    const response = await fetch(`${server_url}/v1/orders/cancel_and_new`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 요청 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Upbit API 오류:', error);
    return NextResponse.json(
      { error: error.message || '취소 후 재주문 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 