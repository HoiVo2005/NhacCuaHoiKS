import type { SourceType } from "@/types";

export interface AdapterContext {
  timeoutMs: number;
  youtubeApiKey?: string;
  /** Client ID cua SoundCloud API (tuy chon nhung cho metadata day du nhat) */
  soundcloudClientId?: string;
  /** Origin cua ung dung, dung de tao URL nhung an toan */
  origin?: string;
}

export interface SourceAdapter {
  type: SourceType;
  label: string;
  /** Kiem tra URL co thuoc nen tang nay khong */
  supports(url: URL): boolean;
  /**
   * Lay metadata chinh thuc tu nen tang (oEmbed / public API).
   * KHONG boc qua DRM hay tai file trai phep.
   */
  resolve(url: URL, context: AdapterContext): Promise<import("@/types").ResolvedMetadata>;
}

export class AdapterError extends Error {
  readonly code: string;

  constructor(message: string, code = "ADAPTER_ERROR") {
    super(message);
    this.name = "AdapterError";
    this.code = code;
  }
}

/** Loi khi nen tang khong con ho tro / khong lay duoc metadata */
export class MetadataUnavailableError extends AdapterError {
  constructor(message: string) {
    super(message, "METADATA_UNAVAILABLE");
    this.name = "MetadataUnavailableError";
  }
}
