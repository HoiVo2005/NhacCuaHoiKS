BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(255) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(20) NOT NULL CONSTRAINT [users_role_df] DEFAULT 'EMPLOYEE',
    [avatarUrl] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [users_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[genres] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [slug] NVARCHAR(120) NOT NULL,
    [description] NVARCHAR(500),
    [color] NVARCHAR(20),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [genres_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [genres_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [genres_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [genres_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[songs] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [artist] NVARCHAR(200),
    [album] NVARCHAR(200),
    [description] NVARCHAR(max),
    [durationSeconds] INT NOT NULL CONSTRAINT [songs_durationSeconds_df] DEFAULT 0,
    [thumbnailUrl] NVARCHAR(1000),
    [sourceType] NVARCHAR(20) NOT NULL,
    [sourceId] NVARCHAR(200),
    [sourceUrl] NVARCHAR(1000),
    [streamUrl] NVARCHAR(1000),
    [embedUrl] NVARCHAR(1000),
    [playbackType] NVARCHAR(20) NOT NULL CONSTRAINT [songs_playbackType_df] DEFAULT 'EMBED',
    [mimeType] NVARCHAR(100),
    [fileSizeBytes] INT,
    [storageKey] NVARCHAR(500),
    [tags] NVARCHAR(500),
    [genreId] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [songs_isPublished_df] DEFAULT 1,
    [playCount] INT NOT NULL CONSTRAINT [songs_playCount_df] DEFAULT 0,
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [songs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [songs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[playlists] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(1000),
    [coverUrl] NVARCHAR(1000),
    [isPublic] BIT NOT NULL CONSTRAINT [playlists_isPublic_df] DEFAULT 0,
    [isFeatured] BIT NOT NULL CONSTRAINT [playlists_isFeatured_df] DEFAULT 0,
    [ownerId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [playlists_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [playlists_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[playlist_songs] (
    [id] NVARCHAR(1000) NOT NULL,
    [playlistId] NVARCHAR(1000) NOT NULL,
    [songId] NVARCHAR(1000) NOT NULL,
    [position] INT NOT NULL CONSTRAINT [playlist_songs_position_df] DEFAULT 0,
    [addedById] NVARCHAR(1000),
    [addedAt] DATETIME2 NOT NULL CONSTRAINT [playlist_songs_addedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [playlist_songs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [playlist_songs_playlistId_songId_key] UNIQUE NONCLUSTERED ([playlistId],[songId])
);

-- CreateTable
CREATE TABLE [dbo].[favorites] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [songId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [favorites_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [favorites_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [favorites_userId_songId_key] UNIQUE NONCLUSTERED ([userId],[songId])
);

-- CreateTable
CREATE TABLE [dbo].[listen_history] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [songId] NVARCHAR(1000) NOT NULL,
    [playedAt] DATETIME2 NOT NULL CONSTRAINT [listen_history_playedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [msPlayed] INT NOT NULL CONSTRAINT [listen_history_msPlayed_df] DEFAULT 0,
    [completed] BIT NOT NULL CONSTRAINT [listen_history_completed_df] DEFAULT 0,
    [source] NVARCHAR(50),
    CONSTRAINT [listen_history_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[app_settings] (
    [key] NVARCHAR(100) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [app_settings_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_role_idx] ON [dbo].[users]([role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_isActive_idx] ON [dbo].[users]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [songs_sourceType_idx] ON [dbo].[songs]([sourceType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [songs_genreId_idx] ON [dbo].[songs]([genreId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [songs_isPublished_idx] ON [dbo].[songs]([isPublished]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [songs_createdAt_idx] ON [dbo].[songs]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [songs_title_idx] ON [dbo].[songs]([title]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [songs_playCount_idx] ON [dbo].[songs]([playCount]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [playlists_ownerId_idx] ON [dbo].[playlists]([ownerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [playlists_isFeatured_idx] ON [dbo].[playlists]([isFeatured]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [playlist_songs_playlistId_position_idx] ON [dbo].[playlist_songs]([playlistId], [position]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [playlist_songs_songId_idx] ON [dbo].[playlist_songs]([songId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [favorites_userId_createdAt_idx] ON [dbo].[favorites]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [listen_history_userId_playedAt_idx] ON [dbo].[listen_history]([userId], [playedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [listen_history_songId_idx] ON [dbo].[listen_history]([songId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [listen_history_playedAt_idx] ON [dbo].[listen_history]([playedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[songs] ADD CONSTRAINT [songs_genreId_fkey] FOREIGN KEY ([genreId]) REFERENCES [dbo].[genres]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[songs] ADD CONSTRAINT [songs_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[songs] ADD CONSTRAINT [songs_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[playlists] ADD CONSTRAINT [playlists_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[playlist_songs] ADD CONSTRAINT [playlist_songs_playlistId_fkey] FOREIGN KEY ([playlistId]) REFERENCES [dbo].[playlists]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[playlist_songs] ADD CONSTRAINT [playlist_songs_songId_fkey] FOREIGN KEY ([songId]) REFERENCES [dbo].[songs]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[playlist_songs] ADD CONSTRAINT [playlist_songs_addedById_fkey] FOREIGN KEY ([addedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[favorites] ADD CONSTRAINT [favorites_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[favorites] ADD CONSTRAINT [favorites_songId_fkey] FOREIGN KEY ([songId]) REFERENCES [dbo].[songs]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[listen_history] ADD CONSTRAINT [listen_history_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[listen_history] ADD CONSTRAINT [listen_history_songId_fkey] FOREIGN KEY ([songId]) REFERENCES [dbo].[songs]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
