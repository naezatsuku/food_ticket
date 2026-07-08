/** ブラウザ専用: 絵文字・画像まわりのユーティリティ */

/** 絵文字を透過PNGのdataURLにラスタライズする(PDF埋め込み用) */
export function emojiToPngDataUrl(emoji: string, sizePx = 256): string {
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.floor(sizePx * 0.78)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText(emoji, sizePx / 2, sizePx / 2 + sizePx * 0.04);
  return canvas.toDataURL("image/png");
}

/**
 * アップロード画像を最大 maxDim px に縮小して dataURL(PNG)で返す。
 * PDFへの埋め込みサイズと localStorage 消費を抑えるため。
 */
export function resizeImageFile(file: File, maxDim = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。png / jpg ファイルを指定してください。"));
    };
    img.src = url;
  });
}

/** dataURL をバイト列に変換(pdf-lib 埋め込み用) */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
