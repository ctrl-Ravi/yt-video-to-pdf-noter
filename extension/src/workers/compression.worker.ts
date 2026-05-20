export interface CompressionRequest {
  id: string;
  imageData: ArrayBuffer;
  width: number;
  height: number;
}

export interface CompressionResponse {
  id: string;
  fullBlob?: Blob;
  thumbnailBlob?: Blob;
  error?: string;
}

function getHue(r: number, g: number, b: number): number {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  let h = 0;
  const d = max - min;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else if (max === b) h = (r - g) / d + 4;
  return Math.round(h * 60);
}

function calculateHueStdDev(pixels: Uint8ClampedArray, width: number, height: number): number {
  const hues: number[] = [];
  const samples = 100;
  const step = Math.max(1, Math.floor((width * height) / samples));

  for (let i = 0; i < width * height; i += step) {
    const idx = i * 4;
    hues.push(getHue(pixels[idx], pixels[idx+1], pixels[idx+2]));
    if (hues.length >= samples) break;
  }

  // Circular mean & stddev
  let sumSin = 0;
  let sumCos = 0;
  for (const h of hues) {
    const rad = h * (Math.PI / 180);
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  
  const meanSin = sumSin / hues.length;
  const meanCos = sumCos / hues.length;
  const r = Math.sqrt(meanSin * meanSin + meanCos * meanCos);
  
  // Circular std dev (in radians)
  if (r <= 0) return 180; // max dispersion
  const stdDevRad = Math.sqrt(-2 * Math.log(r));
  return stdDevRad * (180 / Math.PI);
}

async function processImage(data: ArrayBuffer, width: number, height: number): Promise<{fullBlob: Blob, thumbnailBlob: Blob}> {
  const pixels = new Uint8ClampedArray(data);
  const hueStdDev = calculateHueStdDev(pixels, width, height);
  const usePng = hueStdDev < 15;
  
  const mimeType = usePng ? 'image/png' : 'image/jpeg';
  const quality = usePng ? undefined : 0.85;

  const originalImageData = new ImageData(pixels, width, height);
  
  const drawToCanvas = (targetW: number, targetH: number): OffscreenCanvas => {
    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2d context");
    
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) throw new Error("Could not get 2d context for temp canvas");
    
    tempCtx.putImageData(originalImageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, targetW, targetH);
    return canvas;
  };

  const getScaledDimensions = (maxSide: number) => {
    if (width <= maxSide && height <= maxSide) return { w: width, h: height };
    const ratio = Math.min(maxSide / width, maxSide / height);
    return { w: Math.round(width * ratio), h: Math.round(height * ratio) };
  };

  const fullDim = getScaledDimensions(1920);
  const fullCanvas = drawToCanvas(fullDim.w, fullDim.h);
  const fullBlob = await fullCanvas.convertToBlob({ type: mimeType, quality });

  const thumbDim = getScaledDimensions(320);
  const thumbCanvas = drawToCanvas(thumbDim.w, thumbDim.h);
  const thumbnailBlob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });

  return { fullBlob, thumbnailBlob };
}

self.onmessage = async (e: MessageEvent<CompressionRequest>) => {
  const { id, imageData, width, height } = e.data;
  try {
    const { fullBlob, thumbnailBlob } = await processImage(imageData, width, height);
    self.postMessage({ id, fullBlob, thumbnailBlob } as CompressionResponse);
  } catch (error: any) {
    self.postMessage({ id, error: error.message || 'Unknown error' } as CompressionResponse);
  }
};
