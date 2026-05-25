declare module 'qrcode' {
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}

declare module 'heic2any' {
  export default function heic2any(options: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }): Promise<Blob | Blob[]>;
}
