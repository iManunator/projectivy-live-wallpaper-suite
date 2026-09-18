package com.imanunator.projectivy.livewallpaper.core

data class PickMode(
    val id: String,
    val label: String,
    val group: String,
)

data class ResolvedQuery(
    val layout: String,
    val sort: String,
    val pool: String? = null,
    val minYear: String? = null,
    val minRating: Float? = null,
)

object WallpaperPickModes {
    val ALL: List<PickMode> = listOf(
        PickMode("random", "Random", "Sort"),
        PickMode("latest", "Newest generated", "Sort"),
        PickMode("oldest", "Oldest generated", "Sort"),
        PickMode("rating_high", "Highest rating", "Sort"),
        PickMode("rating_low", "Lowest rating", "Sort"),
        PickMode("year_new", "Newest year", "Sort"),
        PickMode("year_old", "Oldest year", "Sort"),
        PickMode("unwatched", "Unwatched only", "Watch / Library"),
        PickMode("partial", "Partly watched", "Watch / Library"),
        PickMode("watched", "Watched only", "Watch / Library"),
        PickMode("in_library", "In Jellyfin library", "Watch / Library"),
        PickMode("seerr_only", "Seerr only / not in library", "Watch / Library"),
        PickMode("requestable", "Requestable on Seerr", "Watch / Library"),
        PickMode("available_seerr", "Available on Seerr", "Watch / Library"),
        PickMode("source_jellyfin", "Jellyfin-sourced", "Source"),
        PickMode("source_seerr", "Seerr-sourced", "Source"),
        PickMode("source_plex", "Plex-sourced", "Source"),
        PickMode("recent_years", "Recent years", "Source"),
        PickMode("high_rated", "High rated (min rating)", "Source"),
        PickMode("alt_random_latest", "Alternate random ↔ newest", "Mix"),
        PickMode("alt_library_unwatched", "Alternate library ↔ unwatched", "Mix"),
        PickMode("alt_library_seerr", "Alternate library ↔ Seerr-only", "Mix"),
        PickMode("alt_two_layouts", "Alternate two layouts", "Mix"),
        PickMode("mix_weighted", "Weighted mix (random / newest)", "Mix"),
        PickMode("layout_round_robin", "Layout round-robin", "Mix"),
        PickMode("genre_round_robin", "Genre round-robin", "Mix"),
        PickMode("no_repeat_bag", "Random no-repeat bag", "Mix"),
    )

    fun labelFor(id: String): String = ALL.firstOrNull { it.id == id }?.label ?: id

    fun resolve(
        modeId: String,
        primaryLayout: String,
        secondaryLayout: String,
        thirdLayout: String,
        mixRatio: Int,
        recentYears: Int,
        counter: Int,
        currentYear: Int,
        minRating: Float = 0f,
    ): ResolvedQuery {
        val primary = primaryLayout
        val secondary = secondaryLayout.ifBlank { primary }
        val third = thirdLayout.ifBlank { secondary }
        val odd = counter % 2 == 0
        return when (modeId) {
            "latest" -> ResolvedQuery(primary, "latest")
            "oldest" -> ResolvedQuery(primary, "oldest")
            "rating_high" -> ResolvedQuery(primary, "rating")
            "rating_low" -> ResolvedQuery(primary, "rating_asc")
            "year_new" -> ResolvedQuery(primary, "year")
            "year_old" -> ResolvedQuery(primary, "year_asc")
            "unwatched" -> ResolvedQuery(primary, "random", pool = "unwatched")
            "partial" -> ResolvedQuery(primary, "random", pool = "partial")
            "watched" -> ResolvedQuery(primary, "random", pool = "watched")
            "in_library" -> ResolvedQuery(primary, "random", pool = "in_library")
            "seerr_only" -> ResolvedQuery(primary, "random", pool = "seerr_only")
            "requestable" -> ResolvedQuery(primary, "random", pool = "requestable")
            "available_seerr" -> ResolvedQuery(primary, "random", pool = "available")
            "source_jellyfin" -> ResolvedQuery(primary, "random", pool = "source:jellyfin")
            "source_seerr" -> ResolvedQuery(primary, "random", pool = "source:jellyseerr")
            "source_plex" -> ResolvedQuery(primary, "random", pool = "source:plex")
            "recent_years" -> {
                val year = currentYear - recentYears.coerceIn(1, 50)
                ResolvedQuery(primary, "random", minYear = year.toString())
            }
            "high_rated" -> ResolvedQuery(primary, "rating", minRating = minRating)
            "alt_random_latest" ->
                if (odd) ResolvedQuery(primary, "random") else ResolvedQuery(primary, "latest")
            "alt_library_unwatched" ->
                if (odd) ResolvedQuery(primary, "random", pool = "in_library")
                else ResolvedQuery(primary, "random", pool = "unwatched")
            "alt_library_seerr" ->
                if (odd) ResolvedQuery(primary, "random", pool = "in_library")
                else ResolvedQuery(primary, "random", pool = "seerr_only")
            "alt_two_layouts" ->
                if (odd) ResolvedQuery(primary, "random") else ResolvedQuery(secondary, "random")
            "mix_weighted" -> {
                val useLatest = (counter % 100) < mixRatio.coerceIn(0, 100)
                if (useLatest) ResolvedQuery(primary, "latest") else ResolvedQuery(primary, "random")
            }
            "layout_round_robin" -> {
                val layouts = listOf(primary, secondary, third).distinct().filter { it.isNotBlank() }
                if (layouts.isEmpty()) ResolvedQuery(primary, "random")
                else ResolvedQuery(layouts[counter % layouts.size], "random")
            }
            else -> ResolvedQuery(primary, "random")
        }
    }

    fun nextGenreForRoundRobin(genreCsv: String, counter: Int): String? {
        val genres = genreCsv.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (genres.isEmpty()) return null
        return genres[counter % genres.size]
    }
}
