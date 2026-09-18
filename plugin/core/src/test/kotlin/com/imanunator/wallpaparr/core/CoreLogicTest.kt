package com.imanunator.wallpaparr.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class WallpaperPickModesTest {
    @Test
    fun unwatchedMapsToPool() {
        val q = WallpaperPickModes.resolve("unwatched", "Hero", "", "", 30, 3, 0, 2026)
        assertEquals("random", q.sort)
        assertEquals("unwatched", q.pool)
        assertEquals("Hero", q.layout)
    }

    @Test
    fun seerrSourcePool() {
        val q = WallpaperPickModes.resolve("source_seerr", "Hero", "", "", 30, 3, 0, 2026)
        assertEquals("source:jellyseerr", q.pool)
    }

    @Test
    fun altTwoLayoutsFlipsWithCounter() {
        val even = WallpaperPickModes.resolve("alt_two_layouts", "A", "B", "", 30, 3, 0, 2026)
        val odd = WallpaperPickModes.resolve("alt_two_layouts", "A", "B", "", 30, 3, 1, 2026)
        assertEquals("A", even.layout)
        assertEquals("B", odd.layout)
    }

    @Test
    fun mixWeightedUsesRatio() {
        val latest = WallpaperPickModes.resolve("mix_weighted", "A", "", "", 100, 3, 0, 2026)
        val random = WallpaperPickModes.resolve("mix_weighted", "A", "", "", 0, 3, 0, 2026)
        assertEquals("latest", latest.sort)
        assertEquals("random", random.sort)
    }

    @Test
    fun layoutRoundRobin() {
        val first = WallpaperPickModes.resolve("layout_round_robin", "A", "B", "C", 30, 3, 0, 2026)
        val second = WallpaperPickModes.resolve("layout_round_robin", "A", "B", "C", 30, 3, 1, 2026)
        val third = WallpaperPickModes.resolve("layout_round_robin", "A", "B", "C", 30, 3, 2, 2026)
        assertEquals("A", first.layout)
        assertEquals("B", second.layout)
        assertEquals("C", third.layout)
    }

    @Test
    fun genreRoundRobin() {
        assertEquals("Action", WallpaperPickModes.nextGenreForRoundRobin("Action,Drama", 0))
        assertEquals("Drama", WallpaperPickModes.nextGenreForRoundRobin("Action,Drama", 1))
        assertNull(WallpaperPickModes.nextGenreForRoundRobin("", 0))
    }

    @Test
    fun recentYearsComputesMinYear() {
        val q = WallpaperPickModes.resolve("recent_years", "A", "", "", 30, 3, 0, 2026)
        assertEquals("2023", q.minYear)
    }

    @Test
    fun tonightMapsToTastePool() {
        val q = WallpaperPickModes.resolve("tonight", "Hero", "", "", 30, 3, 0, 2026)
        assertEquals("taste:tonight", q.pool)
        assertEquals("random", q.sort)
    }

    @Test
    fun continueWatchingAndNewlyAdded() {
        val watching = WallpaperPickModes.resolve("continue_watching", "Hero", "", "", 30, 3, 0, 2026)
        val newest = WallpaperPickModes.resolve("newly_added", "Hero", "", "", 30, 3, 0, 2026)
        val trending = WallpaperPickModes.resolve("seerr_trending", "Hero", "", "", 30, 3, 0, 2026)
        val pinned = WallpaperPickModes.resolve("pinned", "Hero", "", "", 30, 3, 0, 2026)
        assertEquals("continue_watching", watching.pool)
        assertEquals("latest", newest.sort)
        assertEquals("newly_added", newest.pool)
        assertEquals("source:jellyseerr", trending.pool)
        assertEquals("rating", trending.sort)
        assertEquals("pinned", pinned.pool)
    }
}

class UrlSupportTest {
    @Test
    fun normalizeAddsSchemeAndSlash() {
        assertEquals("http://192.168.1.9:8787/", UrlSupport.normalizeServerUrl("192.168.1.9:8787"))
        assertEquals("http://192.168.1.9:8787/", UrlSupport.normalizeServerUrl("http://192.168.1.9:8787///"))
    }

    @Test
    fun rewriteLocalhostToLanHost() {
        val rewritten = UrlSupport.rewriteMediaUrl(
            "http://127.0.0.1:8787/api/wallpaper/image/Hero/a.jpg",
            "http://192.168.1.9:8787/",
        )
        assertEquals("http://192.168.1.9:8787/api/wallpaper/image/Hero/a.jpg", rewritten)
    }

    @Test
    fun parseYearRange() {
        assertEquals("2005" to "2010", UrlSupport.parseYearRange("2005-2010"))
        assertEquals("2024" to "2024", UrlSupport.parseYearRange("2024"))
    }

    @Test
    fun jellyfinItemId() {
        assertEquals("abc", UrlSupport.parseJellyfinItemId("jellyfin://items/abc"))
        assertNull(UrlSupport.parseJellyfinItemId("https://example/item"))
    }

    @Test
    fun preferMotionVideo() {
        assertTrue(UrlSupport.shouldUseVideo(true, "video", "http://x/a.mp4"))
        assertFalse(UrlSupport.shouldUseVideo(false, "video", "http://x/a.mp4"))
        assertFalse(UrlSupport.shouldUseVideo(true, "image", null))
    }

    @Test
    fun excludeBag() {
        val remembered = UrlSupport.rememberShownPath("a.jpg,b.jpg", "c.jpg", 2)
        assertEquals("c.jpg,a.jpg", remembered)
        assertEquals("c.jpg,a.jpg", UrlSupport.excludeQuery(remembered, 5))
    }
}

class StatusRequestTest {
    @Test
    fun omitsBlankOptionalParams() {
        val map = StatusRequest(layout = "Hero", sort = "random", genre = "", minRating = 0f).toQueryMap()
        assertEquals("Hero", map["layout"])
        assertEquals("random", map["sort"])
        assertFalse(map.containsKey("genre"))
        assertFalse(map.containsKey("min_rating"))
    }

    @Test
    fun includesProfileAndQueue() {
        val map = StatusRequest(layout = "Hero", profile = "tonight", queue = "unwatched").toQueryMap()
        assertEquals("tonight", map["profile"])
        assertEquals("unwatched", map["queue"])
    }
}

class ClientIntentsTest {
    @Test
    fun jellyfinDeepLinkContainsItemId() {
        val uri = ClientIntents.deepLinkIntent("org.jellyfin.androidtv", "item-9")
        assertTrue(uri!!.contains("S.ItemId=item-9"))
        assertTrue(uri.contains("org.jellyfin.androidtv"))
    }

    @Test
    fun launchOnlyClientsHaveNoDeepLink() {
        assertNull(ClientIntents.deepLinkIntent("org.xbmc.kodi", "x"))
    }
}

class MediaChoiceTest {
    @Test
    fun prefersVideoWhenClipExists() {
        val chosen = MediaChoice.choose(
            imageUrl = "http://x/a.jpg",
            videoUrl = "http://x/a.mp4",
            mediaType = "video",
            preferMotion = true,
            fallbackStill = true,
        )
        assertEquals(true, chosen!!.isVideo)
        assertTrue(chosen.uri.endsWith(".mp4"))
    }

    @Test
    fun fallsBackToStillWhenMotionMissing() {
        val chosen = MediaChoice.choose(
            imageUrl = "http://x/a.jpg",
            videoUrl = null,
            mediaType = "image",
            preferMotion = true,
            fallbackStill = true,
        )
        assertEquals(false, chosen!!.isVideo)
    }

    @Test
    fun returnsNullWhenNothingAvailable() {
        val chosen = MediaChoice.choose(
            imageUrl = null,
            videoUrl = null,
            mediaType = "image",
            preferMotion = true,
            fallbackStill = true,
        )
        assertNull(chosen)
    }

    @Test
    fun stillPreferredWhenMotionDisabled() {
        val chosen = MediaChoice.choose(
            imageUrl = "http://x/a.jpg",
            videoUrl = "http://x/a.mp4",
            mediaType = "video",
            preferMotion = false,
            fallbackStill = true,
        )
        assertEquals(false, chosen!!.isVideo)
    }

    @Test
    fun blankVideoUrlDoesNotCountAsMotion() {
        val chosen = MediaChoice.choose(
            imageUrl = "http://x/a.jpg",
            videoUrl = "",
            mediaType = "video",
            preferMotion = true,
            fallbackStill = true,
        )
        assertEquals(false, chosen!!.isVideo)
        assertTrue(chosen.uri.endsWith(".jpg"))
    }
}
