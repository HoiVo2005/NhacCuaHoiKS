export interface SaveObjectInput {
  /** Duong dan tuong doi trong storage, vi du: "songs/2026/abc.mp3" */
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredObject {
  key: string;
  url: string;
  size: number;
}

export interface StorageProvider {
  readonly driver: "local" | "s3";
  save(input: SaveObjectInput): Promise<StoredObject>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}
