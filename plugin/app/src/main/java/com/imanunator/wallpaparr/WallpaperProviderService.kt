package com.imanunator.wallpaparr

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.imanunator.wallpaparr.core.ClientIntents
import com.imanunator.wallpaparr.core.ClientType
import com.imanunator.wallpaparr.core.MediaChoice
import com.imanunator.wallpaparr.core.UrlSupport
import com.imanunator.wallpaparr.core.WallpaperPickModes
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import tv.projectivy.plugin.wallpaperprovider.api.Event
import tv.projectivy.plugin.wallpaperprovider.api.IWallpaperProviderService
import tv.projectivy.plugin.wallpaperprovider.api.Wallpaper
import tv.projectivy.plugin.wallpaperprovider.api.WallpaperDisplayMode
import tv.projectivy.plugin.wallpaperprovider.api.WallpaperType
import java.util.Calendar

class WallpaperProviderService : Service() {

    override fun onCreate() {
        super.onCreate()
        PreferencesManager.init(this)
    }

    override fun onBind(intent: Intent): IBinder = binder

    private fun createApi(serverUrl: String): ApiService {
        val base = UrlSupport.normalizeServerUrl(serverUrl)
        return Retrofit.Builder()
            .baseUrl(base)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    private fun fetchStatus(
        api: ApiService,
        layout: String,
        genre: String?,
        age: String?,
        minYear: String?,
        maxYear: String?,
        minRating: Float?,
        maxRating: Float?,
        sort: String?,
        pool: String?,
        exclude: String?,
    ): WallpaperStatus? {
        val response = api.getWallpaperStatus(
            layout, genre, age, minYear, maxYear, minRating, maxRating, sort, pool, exclude,
        ).execute()
        if (!response.isSuccessful) return null
        val body = response.body() ?: return null
        return body.copy(imageUrl = UrlSupport.rewriteMediaUrl(body.imageUrl, PreferencesManager.serverUrl))
    }

    private fun toWallpaper(status: WallpaperStatus, author: String): Wallpaper? {
        val videoUrl = UrlSupport.rewriteMediaUrl(status.videoUrl, PreferencesManager.serverUrl)
        val imageUrl = UrlSupport.rewriteMediaUrl(status.imageUrl, PreferencesManager.serverUrl)
        val chosen = MediaChoice.choose(
            imageUrl = imageUrl,
            videoUrl = videoUrl,
            mediaType = status.mediaType,
            preferMotion = PreferencesManager.preferMotion,
            fallbackStill = PreferencesManager.fallbackStill,
        ) ?: return null
        val mediaUrl = chosen.uri
        val useVideo = chosen.isVideo
        var action = status.actionUrl
        val itemId = UrlSupport.parseJellyfinItemId(action)
        if (itemId != null) {
            val preferred = PreferencesManager.preferredClient
            val client = ClientIntents.SUPPORTED.find { it.packageName == preferred }
            action = when (client?.type) {
                ClientType.DEEP_LINK -> ClientIntents.deepLinkIntent(preferred, itemId) ?: action
                ClientType.LAUNCH -> ClientIntents.launchIntent(preferred) ?: action
                else -> action
            }
        }
        PreferencesManager.lastWallpaperUri = mediaUrl
        PreferencesManager.lastWallpaperAuthor = author
        PreferencesManager.rememberShownPath(status.path ?: mediaUrl)
        return Wallpaper(
            uri = mediaUrl,
            type = if (useVideo) WallpaperType.VIDEO else WallpaperType.IMAGE,
            displayMode = WallpaperDisplayMode.CROP,
            title = status.title,
            author = author,
            actionUri = action,
        )
    }

    private val binder = object : IWallpaperProviderService.Stub() {
        override fun getWallpapers(event: Event?): List<Wallpaper> {
            var forceRefresh = false
            if (event is Event.LauncherIdleModeChanged) {
                if (!event.isIdle) {
                    if (PreferencesManager.refreshOnIdleExit) {
                        forceRefresh = true
                    } else {
                        val lastUri = PreferencesManager.lastWallpaperUri
                        if (lastUri.isNotBlank()) {
                            val isVideo = lastUri.contains(".mp4", ignoreCase = true)
                            return listOf(
                                Wallpaper(
                                    uri = lastUri,
                                    type = if (isVideo) WallpaperType.VIDEO else WallpaperType.IMAGE,
                                    displayMode = WallpaperDisplayMode.CROP,
                                    author = PreferencesManager.lastWallpaperAuthor.ifBlank { null },
                                )
                            )
                        }
                        return emptyList()
                    }
                } else {
                    return emptyList()
                }
            }

            if (event is Event.TimeElapsed || event == null || forceRefresh) {
                val serverUrl = PreferencesManager.serverUrl
                if (serverUrl.isBlank()) return emptyList()
                val counter = PreferencesManager.wallpaperRotateCounter
                val pickMode = PreferencesManager.wallpaperPickMode
                val resolved = WallpaperPickModes.resolve(
                    modeId = pickMode,
                    primaryLayout = PreferencesManager.selectedLayout,
                    secondaryLayout = PreferencesManager.secondaryLayout,
                    thirdLayout = PreferencesManager.thirdLayout,
                    mixRatio = PreferencesManager.mixRatio,
                    recentYears = PreferencesManager.recentYears,
                    counter = counter,
                    currentYear = Calendar.getInstance().get(Calendar.YEAR),
                    minRating = PreferencesManager.minRating,
                )
                var genreFilter = PreferencesManager.genreFilter.ifEmpty { null }
                if (pickMode == "genre_round_robin") {
                    genreFilter = WallpaperPickModes.nextGenreForRoundRobin(
                        PreferencesManager.genreFilter, counter,
                    ) ?: genreFilter
                }
                val (parsedMin, parsedMax) = UrlSupport.parseYearRange(PreferencesManager.yearFilter)
                val minYear = resolved.minYear ?: parsedMin
                val maxYear = if (resolved.minYear != null) null else parsedMax
                try {
                    val api = createApi(serverUrl)
                    val imageLayouts = runCatching { api.getLayoutsWithImages().execute().body().orEmpty() }
                        .getOrDefault(emptyList())
                    val allLayouts = runCatching { api.getLayouts().execute().body().orEmpty() }
                        .getOrDefault(emptyList())
                    val layoutPool = imageLayouts.ifEmpty { allLayouts }
                    fun match(wanted: String) = layoutPool.firstOrNull { it.equals(wanted, true) }
                        ?: allLayouts.firstOrNull { it.equals(wanted, true) }
                    val preferred = match(PreferencesManager.selectedLayout)
                    val layoutToUse = when (pickMode) {
                        "layout_round_robin" -> {
                            val pool = listOfNotNull(preferred, match(PreferencesManager.secondaryLayout), match(PreferencesManager.thirdLayout))
                                .ifEmpty { layoutPool }
                            pool[counter % pool.size.coerceAtLeast(1)]
                        }
                        "alt_two_layouts" -> {
                            val a = preferred ?: layoutPool.firstOrNull().orEmpty()
                            val b = match(PreferencesManager.secondaryLayout) ?: layoutPool.getOrNull(1) ?: a
                            if (counter % 2 == 0) a else b
                        }
                        else -> match(resolved.layout) ?: preferred ?: layoutPool.firstOrNull().orEmpty()
                    }
                    if (layoutToUse.isBlank()) return emptyList()
                    var status = fetchStatus(
                        api, layoutToUse, genreFilter,
                        PreferencesManager.ageFilter.ifEmpty { null },
                        minYear, maxYear,
                        PreferencesManager.minRating.takeIf { it > 0f } ?: resolved.minRating,
                        PreferencesManager.maxRating.takeIf { it < 10f },
                        resolved.sort, resolved.pool, PreferencesManager.excludeQueryValue(),
                    )
                    if (status?.imageUrl.isNullOrBlank()) {
                        status = fetchStatus(api, layoutToUse, null, null, null, null, null, null, "random", null, null)
                    }
                    if (status?.imageUrl.isNullOrBlank()) {
                        for (alt in layoutPool) {
                            if (alt.equals(layoutToUse, true)) continue
                            status = fetchStatus(api, alt, null, null, null, null, null, null, "random", null, null)
                            if (!status?.imageUrl.isNullOrBlank()) break
                        }
                    }
                    PreferencesManager.wallpaperRotateCounter = counter + 1
                    return status?.let { toWallpaper(it, WallpaperPickModes.labelFor(pickMode)) }?.let { listOf(it) }
                        ?: emptyList()
                } catch (e: Exception) {
                    Log.e("Wallpaparr", "getWallpapers failed", e)
                }
            }
            return emptyList()
        }

        override fun getPreferences(): String = PreferencesManager.export()
        override fun setPreferences(params: String) {
            PreferencesManager.import(params)
        }
    }
}
