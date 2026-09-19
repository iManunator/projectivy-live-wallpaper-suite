package com.imanunator.wallpaparr.core

enum class ClientType { DEEP_LINK, LAUNCH }

data class ClientProfile(
    val name: String,
    val packageName: String,
    val type: ClientType,
    val help: String,
)

object ClientIntents {
    const val SEERRTV_PACKAGE = "ca.devmesh.seerrtv"
    const val MOONFIN_PACKAGE = "org.moonfin.androidtv"
    const val JELLYFIN_PACKAGE = "org.jellyfin.androidtv"

    val SUPPORTED: List<ClientProfile> = listOf(
        ClientProfile(
            "Moonfin",
            MOONFIN_PACKAGE,
            ClientType.DEEP_LINK,
            "Opens this title in Moonfin (Jellyfin Android TV fork). Best if Moonfin is your player.",
        ),
        ClientProfile(
            "Jellyfin",
            JELLYFIN_PACKAGE,
            ClientType.DEEP_LINK,
            "Opens this title in Jellyfin Android TV. Default when you click the wallpaper.",
        ),
        ClientProfile(
            "SeerrTV",
            SEERRTV_PACKAGE,
            ClientType.LAUNCH,
            "Opens Seerr / Jellyseerr request titles in SeerrTV. Library titles still use Moonfin when preferred.",
        ),
        ClientProfile(
            "Fladder",
            "nl.jknaapen.fladder",
            ClientType.LAUNCH,
            "Launches Fladder. Cannot deep-link this title — you land on the app home.",
        ),
        ClientProfile(
            "Kodi",
            "org.xbmc.kodi",
            ClientType.LAUNCH,
            "Launches Kodi. Cannot deep-link this title — you land on the app home.",
        ),
        ClientProfile(
            "Wholphin",
            "com.github.damontecres.wholphin",
            ClientType.LAUNCH,
            "Launches Wholphin. Cannot deep-link this title — you land on the app home.",
        ),
        ClientProfile(
            "Void",
            "com.hritwik.avoid",
            ClientType.LAUNCH,
            "Launches Void (Leanback). Cannot deep-link this title — you land on the app home.",
        ),
    )

    fun at(index: Int): ClientProfile? = SUPPORTED.getOrNull(index)

    fun deepLinkIntent(packageName: String, itemId: String): String? {
        val component = when (packageName) {
            MOONFIN_PACKAGE -> "$MOONFIN_PACKAGE/org.jellyfin.androidtv.ui.startup.StartupActivity"
            JELLYFIN_PACKAGE -> "$JELLYFIN_PACKAGE/org.jellyfin.androidtv.ui.startup.StartupActivity"
            else -> return null
        }
        // ItemId is the Jellyfin Android TV / Moonfin IR extra Projectivy passes through.
        return "intent:#Intent;component=$component;action=android.intent.action.VIEW;S.ItemId=$itemId;S.id=$itemId;end"
    }

    fun launchIntent(packageName: String): String? {
        if (packageName == "com.hritwik.avoid") {
            return "intent:#Intent;component=com.hritwik.avoid/com.hritwik.avoid.LeanbackLauncher;action=android.intent.action.MAIN;category=android.intent.category.LEANBACK_LAUNCHER;end"
        }
        if (packageName == SEERRTV_PACKAGE) {
            return "intent:#Intent;package=$SEERRTV_PACKAGE;action=android.intent.action.MAIN;category=android.intent.category.LEANBACK_LAUNCHER;end"
        }
        return null
    }

    /**
     * Seerr / Jellyseerr web URLs → SeerrTV. Prefer VIEW with the same path so
     * SeerrTV can land on the movie/show when it supports the URL.
     */
    fun seerrTvIntent(actionUrl: String?): String? {
        val raw = actionUrl?.trim().orEmpty()
        if (raw.isEmpty()) return launchIntent(SEERRTV_PACKAGE)
        return try {
            val uri = java.net.URI(raw)
            val path = uri.path?.trim('/').orEmpty()
            if (path.isEmpty()) return launchIntent(SEERRTV_PACKAGE)
            val host = uri.host ?: return launchIntent(SEERRTV_PACKAGE)
            val port = if (uri.port > 0) ":${uri.port}" else ""
            val scheme = uri.scheme ?: "http"
            "intent://$host$port/${path}#Intent;scheme=$scheme;package=$SEERRTV_PACKAGE;action=android.intent.action.VIEW;end"
        } catch (_: Exception) {
            launchIntent(SEERRTV_PACKAGE)
        }
    }

    /**
     * Library titles (jellyfin://) → preferred Moonfin/Jellyfin IR.
     * Seerr-only HTTP action URLs → SeerrTV (never the browser).
     */
    fun resolveActionUri(preferredPackage: String?, actionUrl: String?): String? {
        val action = actionUrl?.trim()?.ifBlank { null }
        val itemId = UrlSupport.parseJellyfinItemId(action)
        if (itemId != null) {
            val preferred = preferredPackage?.trim().orEmpty()
            val client = SUPPORTED.find { it.packageName == preferred }
            return when (client?.type) {
                ClientType.DEEP_LINK -> deepLinkIntent(preferred, itemId) ?: action
                ClientType.LAUNCH -> {
                    // SeerrTV cannot open a Jellyfin item — fall back to Moonfin IR.
                    if (preferred == SEERRTV_PACKAGE) {
                        deepLinkIntent(MOONFIN_PACKAGE, itemId) ?: action
                    } else {
                        launchIntent(preferred) ?: action
                    }
                }
                else -> deepLinkIntent(MOONFIN_PACKAGE, itemId) ?: action
            }
        }
        if (UrlSupport.isSeerrActionUrl(action)) {
            return seerrTvIntent(action)
        }
        return action
    }
}
