export interface CompressionResult {
  fullBlob: Blob;
  thumbnailBlob: Blob;
  uncompressed: boolean;
}

let workerInstance: Worker | null = null;
let messageId = 0;
const pending = new Map<string, { resolve: (res: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./compression.worker.ts', import.meta.url), { type: 'module' });
    workerInstance.onmessage = (e: MessageEvent) => {
      const { id, fullBlob, thumbnailBlob, error } = e.data;
      const resolver = pending.get(id);
      if (resolver) {
        pending.delete(id);
        if (error) resolver.reject(new Error(error));
        else resolver.resolve({ fullBlob, thumbnailBlob });
      }
    };
  }
  return workerInstance;
}

export async function compressImage(imageData: ArrayBuffer, width: number, height: number): Promise<CompressionResult> {
  const bufferCopy = imageData.slice(0);
  
  try {
    const worker = getWorker();
    const id = String(++messageId);
    
    const promise = new Promise<{fullBlob: Blob, thumbnailBlob: Blob}>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    
    worker.postMessage({ id, imageData: bufferCopy, width, height }, [bufferCopy]);
    
    const { fullBlob, thumbnailBlob } = await promise;
    return { fullBlob, thumbnailBlob, uncompressed: false };
  } catch (error) {
    console.error('Compression worker failed, falling back:', error);
    const rawBlob = new Blob([imageData], { type: 'application/octet-stream' });
    return {
      fullBlob: rawBlob,
      thumbnailBlob: rawBlob,
      uncompressed: true
    };
  }
}
