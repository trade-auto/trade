import { NextResponse } from 'next/server';
import ollama from 'ollama';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SignalReason {
  time: number;
  signal: string;
  confidence: number;
  reason: string;
}

export async function POST(req: Request) {
  try {
    const { candles, timeframe } = await req.json();
    
    // OLLAMA API 호출을 위한 프롬프트 생성
    const prompt = `당신은 암호화폐 트레이딩 전문가입니다. 
주어진 캔들스틱 데이터를 분석하여 매수/매도 신호를 생성해주세요.

시간프레임: ${timeframe}

다음 JSON 형식으로만 응답해주세요:
{
  "signals": ["BUY", "SELL", "HOLD"],
  "reasons": [
    {
      "time": number,
      "signal": "BUY" | "SELL" | "HOLD",
      "confidence": number (0.0-1.0),
      "reason": string
    }
  ]
}

분석 기준:
1. 추세 분석: 상승/하락 추세 강도, 추세 전환 가능성
2. 거래량: 거래량 증감, 가격과의 상관관계
3. 변동성: 캔들 크기, 상하단 그림자
4. 기술적 패턴: 캔들스틱 패턴, 지지/저항

캔들스틱 데이터:
${JSON.stringify(candles, null, 2)}

응답은 반드시 위의 JSON 형식을 따라야 하며, 각 캔들에 대한 신호와 이유를 포함해야 합니다.
신호의 개수는 입력된 캔들의 개수와 정확히 일치해야 합니다.`;

    // OLLAMA API 호출
    try {
      // 실제 분석 요청
      const message = { role: 'user', content: prompt };
      const response = await ollama.chat({ 
        model: 'deepseek-r1:32b', 
        messages: [message],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.7,
          top_p: 0.7
        }
      });

      console.log('OLLAMA 원본 응답:', response);

      // 응답이 없거나 content가 없는 경우 처리
      if (!response || !response.message || !response.message.content) {
        console.error('OLLAMA 응답이 비어있습니다');
        throw new Error('OLLAMA 응답이 비어있습니다');
      }

      let responseText = response.message.content.trim();
      console.log('OLLAMA 응답 텍스트:', responseText);

      // JSON 형식이 아닌 경우 처리
      if (!responseText.startsWith('{')) {
        // JSON 형식 찾기
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseText = jsonMatch[0];
        } else {
          throw new Error('유효한 JSON 응답을 찾을 수 없습니다');
        }
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 파싱 실패:', parseError, '\n응답 텍스트:', responseText);
        
        // 기본 응답 생성
        parsedResult = {
          signals: candles.map(() => 'HOLD'),
          reasons: candles.map((candle: CandleData) => ({
            time: candle.time,
            signal: 'HOLD',
            confidence: 0.5,
            reason: 'JSON 파싱 실패'
          }))
        };
      }

      // 결과 검증 및 변환
      const result = {
        signals: Array.isArray(parsedResult.signals) ? 
          parsedResult.signals.map((signal: string) => 
            signal === 'BUY' || signal === 'SELL' ? signal : 'HOLD'
          ) : candles.map(() => 'HOLD'),
        reasons: Array.isArray(parsedResult.reasons) ?
          parsedResult.reasons.map((reason: SignalReason, index: number) => ({
            time: candles[index].time,
            signal: reason.signal === 'BUY' || reason.signal === 'SELL' ? reason.signal : 'HOLD',
            confidence: Math.max(0, Math.min(1, reason.confidence || 0.5)),
            reason: reason.reason || '분석 불가'
          })) : candles.map((candle: CandleData) => ({
            time: candle.time,
            signal: 'HOLD',
            confidence: 0.5,
            reason: '분석 불가'
          }))
      };

      return new NextResponse(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('OLLAMA API 오류:', error);
      
      // 에러 발생 시 기본 응답 반환
      const fallbackResult = {
        signals: candles.map(() => 'HOLD'),
        reasons: candles.map((candle: CandleData) => ({
          time: candle.time,
          signal: 'HOLD',
          confidence: 0.5,
          reason: '서버 오류로 인한 분석 불가'
        }))
      };

      return new NextResponse(JSON.stringify(fallbackResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('OLLAMA API 오류:', error);
    return NextResponse.json({ error: '분석 중 오류 발생' }, { status: 500 });
  }
} 