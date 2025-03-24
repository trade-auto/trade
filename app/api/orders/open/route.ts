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
    const market = searchParams.get('market') || 'KRW-BTC';
    const states = ['wait', 'watch'];

    // 비배열 파라미터
    const non_array_body = {
      market,
    };

    // states 쿼리 문자열 생성
    const states_query = states.map(state => `states[]=${state}`).join('&');
    const query = querystring.encode(non_array_body) + '&' + states_query;

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

    // 응답 타임아웃 추가 (10초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${server_url}/v1/orders/open?${query}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upbit API 오류 상태: ${response.status}, 응답: ${errorText}`);
        
        return NextResponse.json(
          { error: `체결 대기 주문 조회 실패: ${response.status} - ${errorText.substring(0, 100)}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Upbit API 요청 타임아웃');
        return NextResponse.json(
          { error: '체결 대기 주문 조회 요청 시간 초과' },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Upbit API 오류:', error);
    return NextResponse.json(
      { error: error.message || '체결 대기 주문 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 