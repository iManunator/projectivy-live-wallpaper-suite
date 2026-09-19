package com.imanunator.wallpaparr.core

enum class ClientType { DEEP_LINK, LAUNCH }

data class ClientProfile(
    val name: String,
    val packageName: String,
    val type: ClientType,
    val help: String,
)

object ClientIntents {
    val SUPPORTED: List<ClientProfile> = listOf(
        ClientProfile(
            "Moonfin",
            "org.moonfin.androidtv",
            ClientType.DEEP_LINK,
            "Opens this title in Moonfin (Jellyfin Android TV fork). Best if Moonfin is your player.",
        ),
        ClientProfile(
            "Jellyfin",
            "org.jellyfin.androidtv",
            ClientType.DEEP_LINK,
            "Opens this title in Jellyfin Android TV. Default when you click the wallpaper.",
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
            "org.moonfin.androidtv" -> "org.moonfin.androidtv/org.jellyfin.androidtv.ui.startup.StartupActivity"
            "org.jellyfin.androidtv" -> "org.jellyfin.androidtv/org.jellyfin.androidtv.ui.startup.StartupActivity"
            else -> return null
        }
        return "intent:#Intent;component=$component;action=android.intent.action.VIEW;S.ItemId=$itemId;S.id=$itemId;end"
    }

    fun launchIntent(packageName: String): String? {
        if (packageName == "com.hritwik.avoid") {
            return "intent:#Intent;component=com.hritwik.avoid/com.hritwik.avoid.LeanbackLauncher;action=android.intent.action.MAIN;category=android.intent.category.LEANBACK_LAUNCHER;end"
        }
        return null
    }
}
