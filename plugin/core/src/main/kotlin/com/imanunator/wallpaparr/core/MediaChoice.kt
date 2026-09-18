package com.imanunator.wallpaparr.core

data class ChosenWallpaper(val uri: String, val isVideo: Boolean)

object MediaChoice {
    /**
     * Projectivy IMAGE vs VIDEO selection.
     * IMAGE = JPEG still. VIDEO = looping MP4 (parallax / Ken Burns).
     * Prefer motion when a clip exists; otherwise fall back to the still.
     */
    fun choose(
        imageUrl: String?,
        videoUrl: String?,
        mediaType: String?,
        preferMotion: Boolean,
        fallbackStill: Boolean = true,
    ): ChosenWallpaper? {
        val hasVideo = !videoUrl.isNullOrBlank() && (
            mediaType.equals("video", ignoreCase = true) ||
                videoUrl.contains(".mp4", ignoreCase = true)
            )
        if (preferMotion && hasVideo) {
            return ChosenWallpaper(videoUrl!!, true)
        }
        if (!imageUrl.isNullOrBlank()) {
            return ChosenWallpaper(imageUrl, false)
        }
        if (!fallbackStill && hasVideo) {
            return ChosenWallpaper(videoUrl!!, true)
        }
        return null
    }
}
