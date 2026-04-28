/**
 * 사진 → 도안 변환 (Replicate API 모드).
 *
 * Supabase Edge Function `photo-to-outline`을 프록시로 호출한다.
 * 토큰은 서버에 보관되므로 클라이언트엔 노출되지 않는다.
 */

import { supabase } from '@/supabase/client';

const FUNCTION_NAME = 'photo-to-outline';

async function imageToDataUrl(image: HTMLImageElement | Blob): Promise<string> {
  const blob =
    image instanceof Blob
      ? image
      : await fetch(image.src).then((r) => r.blob());

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 인코딩 실패'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Replicate flux-kontext-pro로 도안 변환.
 * 보통 5~20초 소요.
 */
type FunctionResponse = { outline?: string; error?: string };

export async function convertPhotoToOutlineApi(
  source: HTMLImageElement | Blob,
  prompt?: string,
): Promise<Blob> {
  const dataUrl = await imageToDataUrl(source);

  const { data, error } = await supabase.functions.invoke<FunctionResponse>(FUNCTION_NAME, {
    body: { image: dataUrl, prompt },
  });

  if (error) {
    const detail = (error as unknown as { context?: { responseText?: string } }).context
      ?.responseText;
    throw new Error(detail ? `${error.message}: ${detail}` : error.message);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Edge Function이 빈 응답을 반환했습니다.');
  }
  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.outline || typeof data.outline !== 'string') {
    throw new Error('변환 결과 이미지가 없습니다.');
  }
  // data URL → Blob (호출부가 Blob을 기대)
  const res = await fetch(data.outline);
  return await res.blob();
}
