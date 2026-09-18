package com.imanunator.projectivy.livewallpaper.core

enum class ClientType { DEEP_LINK, LAUNCH }

data class ClientProfile(
    val name: String,
    val packageName: String,
    val type: ClientType,
)

object ClientIntents {
    val SUPPORTED: List<ClientProfile> = listOf(
        ClientProfile("Moonfin", "org.moonfin.androidtv", ClientType.DEEP_LINK),
        ClientProfile("Jellyfin", "org.jellyfin.androidtv", ClientType.DEEP_LINK),
        ClientProfile("Fladder", "nl.jknaapen.fladder", ClientType.LAUNCH),
        ClientProfile("Kodi", "org.xbmc.kodi", ClientType.LAUNCH),
        ClientProfile("Wholphin", "com.github.damontecres.wholphin", ClientType.LAUNCH),
        ClientProfile("Void", "com.hritwik.avoid", ClientType.LAUNCH),
    )

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
