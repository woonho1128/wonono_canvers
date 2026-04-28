// 사진 → 도안 변환 (Replicate flux-kontext-pro 프록시).
//
// 클라이언트는 사진을 base64 또는 공개 URL로 전달.
// Edge Function이 Replicate API를 호출하고 결과 PNG 바이트를 반환한다.
// REPLICATE_API_TOKEN은 Supabase secrets에 저장 (코드에 노출 X).

// deno-lint-ignore-file no-explicit-any

const REPLICATE_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
const MODEL = 'black-forest-labs/flux-kontext-pro';

const DEFAULT_PROMPT =
  'Convert this image into a black and white coloring book page for children. ' +
  'Clean thick black outlines only, no shading, no gray, no color fill, ' +
  'pure white background, simple line art, suitable for kids to color.';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((s) => s.trim());

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
      ? origin ?? '*'
      : ALLOWED_ORIGINS[0] ?? '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Vary': 'Origin',
  };
}

function jsonError(message: string, status: number, origin: string | null): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return jsonError('Method Not Allowed', 405, origin);
  }
  if (!REPLICATE_TOKEN) {
    return jsonError('REPLICATE_API_TOKEN not configured on server', 500, origin);
  }

  let body: { image?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400, origin);
  }

  const image = body.image;
  if (!image || typeof image !== 'string') {
    return jsonError('Missing "image" (data URL or https URL)', 400, origin);
  }

  // Replicate는 data URL과 https URL 둘 다 받아준다.
  // base64는 보통 5~10MB까지 OK. 너무 크면 거부.
  if (image.startsWith('data:') && image.length > 12_000_000) {
    return jsonError('Image too large (>~9MB). Please resize first.', 413, origin);
  }

  const prompt = (typeof body.prompt === 'string' && body.prompt.trim()) || DEFAULT_PROMPT;

  // 1) Prediction 생성. Prefer: wait 헤더로 polling 없이 결과 대기 (최대 60s).
  const createRes = await fetch(
    `https://api.replicate.com/v1/models/${MODEL}/predictions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({
        input: {
          prompt,
          input_image: image,
          output_format: 'png',
        },
      }),
    },
  );

  if (!createRes.ok) {
    const detail = await createRes.text();
    return jsonError(`Replicate error: ${createRes.status} ${detail}`, 502, origin);
  }

  let prediction: any = await createRes.json();

  // 60초 안에 안 끝났으면 polling으로 마저 대기 (최대 추가 90s).
  const startedAt = Date.now();
  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled'
  ) {
    if (Date.now() - startedAt > 90_000) {
      return jsonError('Conversion timed out', 504, origin);
    }
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
    });
    if (!pollRes.ok) {
      return jsonError(`Replicate poll failed: ${pollRes.status}`, 502, origin);
    }
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    return jsonError(
      `Conversion ${prediction.status}: ${prediction.error ?? 'unknown'}`,
      502,
      origin,
    );
  }

  // output: 문자열 URL 또는 URL 배열 (모델마다 다름)
  const outputUrl: string | undefined = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;
  if (!outputUrl || typeof outputUrl !== 'string') {
    return jsonError('Replicate returned no output URL', 502, origin);
  }

  // 결과 PNG를 그대로 스트리밍 반환 (브라우저가 Blob으로 받음).
  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok || !imgRes.body) {
    return jsonError(`Failed to fetch output image: ${imgRes.status}`, 502, origin);
  }

  return new Response(imgRes.body, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': imgRes.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'no-store',
    },
  });
});
