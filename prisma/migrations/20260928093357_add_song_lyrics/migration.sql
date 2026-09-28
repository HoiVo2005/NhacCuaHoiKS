BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[song_lyrics] (
    [id] NVARCHAR(1000) NOT NULL,
    [songId] NVARCHAR(1000) NOT NULL,
    [syncedLyrics] NVARCHAR(max),
    [plainLyrics] NVARCHAR(max),
    [source] NVARCHAR(20) NOT NULL,
    [matchedTrack] NVARCHAR(300),
    [matchedArtist] NVARCHAR(200),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [song_lyrics_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [song_lyrics_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [song_lyrics_songId_key] UNIQUE NONCLUSTERED ([songId])
);

-- AddForeignKey
ALTER TABLE [dbo].[song_lyrics] ADD CONSTRAINT [song_lyrics_songId_fkey] FOREIGN KEY ([songId]) REFERENCES [dbo].[songs]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
