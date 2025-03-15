import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import querystring from 'querystring';

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const uuids = searchParams.getAll('uuids[]');
    const state = searchParams.get('state') || 'done';

    // 비배열 파라미터
    const non_array_body = {
      state,
    };

    // UUID 쿼리 문자열 생성
    const uuid_query = uuids.map(uuid => `uuids[]=${uuid}`).join('&');
    const query = querystring.encode(non_array_body) + '&' + uuid_query;

    // 쿼리 해시 생성
    const hash = crypto.createHash('sha512');
    const queryHash = hash.update(query, 'utf-8').digest('hex');

    // JWT 페이로드 구성
    const payload = {
      access_key,
      nonce: uuidv4(),
      query_hash: queryHash,
      query_hash_alg: 'SHA512',
    };

    const token = sign(payload, secret_key);

    const response = await fetch(`${server_url}/v1/orders?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
      { error: error.message || '주문 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 