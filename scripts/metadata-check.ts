import "dotenv/config";

import { resolveMetadataFromUrl } from "@/lib/music/adapters";

/** Kiem tra lay metadata: npx tsx scripts/metadata-check.ts <url> */
async function main() {
  const target =
    process.argv[2] ??
    "https://soundcloud.com/forss/flickermood";

  console.log("DANG LAY METADATA:", target);

  try {
    const metadata = await resolveMetadataFromUrl(target);
    console.log(
      JSON.stringify(
        {
          sourceType: metadata.sourceType,
          sourceId: metadata.sourceId,
          title: metadata.title,
          artist: metadata.artist,
          durationSeconds: metadata.durationSeconds,
          thumbnailUrl: metadata.thumbnailUrl,
          genre: metadata.genre ?? null,
          tags: metadata.tags ?? [],
          provider: metadata.provider,
          embedUrl: metadata.embedUrl,
          warnings: metadata.warnings,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("LOI:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
