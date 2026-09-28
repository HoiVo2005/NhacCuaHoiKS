import type { SaveObjectInput, StorageProvider, StoredObject } from "./types";

interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
}

function readS3Config(): S3Config {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Thiếu cấu hình S3 (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). Kiểm tra file .env.",
    );
  }

  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  };
}

/**
 * Storage tren S3/MinIO. Thu vien AWS SDK duoc import dong
 * nen chi duoc nap khi thuc su bat STORAGE_DRIVER=s3.
 */
class S3StorageProvider implements StorageProvider {
  readonly driver = "s3" as const;
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  publicUrl(key: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
    }
    if (this.config.endpoint) {
      return `${this.config.endpoint.replace(/\/+$/, "")}/${this.config.bucket}/${key}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  private async getClient() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async save({ key, body, contentType }: SaveObjectInput): Promise<StoredObject> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return { key, url: this.publicUrl(key), size: body.byteLength };
  }

  async remove(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();

    await client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}

export function createS3Storage(): StorageProvider {
  return new S3StorageProvider(readS3Config());
}
