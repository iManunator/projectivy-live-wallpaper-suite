package com.imanunator.projectivy.livewallpaper

import android.os.Bundle
import androidx.leanback.app.GuidedStepSupportFragment
import androidx.leanback.widget.GuidanceStylist
import androidx.leanback.widget.GuidedAction
import com.imanunator.projectivy.livewallpaper.core.ClientIntents
import com.imanunator.projectivy.livewallpaper.core.WallpaperPickModes

class SettingsFragment : GuidedStepSupportFragment() {
    override fun onCreateGuidance(savedInstanceState: Bundle?): GuidanceStylist.Guidance {
        return GuidanceStylist.Guidance(
            getString(R.string.plugin_name),
            getString(R.string.plugin_description),
            getString(R.string.settings),
            requireContext().getDrawable(R.drawable.ic_plugin),
        )
    }

    override fun onCreateActions(actions: MutableList<GuidedAction>, savedInstanceState: Bundle?) {
        PreferencesManager.init(requireContext())
        actions += editable(ID_SERVER, "Server URL", PreferencesManager.serverUrl)
        actions += editable(ID_LAYOUT, "Collection / Layout", PreferencesManager.selectedLayout)
        actions += listAction(
            ID_PICK,
            "Wallpaper pick mode",
            WallpaperPickModes.labelFor(PreferencesManager.wallpaperPickMode),
            WallpaperPickModes.ALL.map { it.label },
        )
        actions += GuidedAction.Builder(context)
            .id(ID_MOTION)
            .title("Prefer motion video")
            .checkSetId(GuidedAction.CHECKBOX_CHECK_SET_ID)
            .checked(PreferencesManager.preferMotion)
            .build()
        actions += editable(ID_SECONDARY, "Secondary layout", PreferencesManager.secondaryLayout)
        actions += editable(ID_GENRE, "Genre filter (comma)", PreferencesManager.genreFilter)
        actions += editable(ID_AGE, "Age rating filter", PreferencesManager.ageFilter)
        actions += editable(ID_YEAR, "Year or range (2005-2010)", PreferencesManager.yearFilter)
        actions += listAction(
            ID_CLIENT,
            "Preferred client",
            ClientIntents.SUPPORTED.firstOrNull { it.packageName == PreferencesManager.preferredClient }?.name
                ?: PreferencesManager.preferredClient,
            ClientIntents.SUPPORTED.map { it.name },
        )
        actions += GuidedAction.Builder(context)
            .id(ID_IDLE)
            .title("Refresh on idle exit")
            .checkSetId(GuidedAction.CHECKBOX_CHECK_SET_ID)
            .checked(PreferencesManager.refreshOnIdleExit)
            .build()
    }

    override fun onGuidedActionClicked(action: GuidedAction) {
        when (action.id) {
            ID_MOTION -> PreferencesManager.preferMotion = action.isChecked
            ID_IDLE -> PreferencesManager.refreshOnIdleExit = action.isChecked
        }
        (activity as? SettingsActivity)?.requestWallpaperUpdate()
    }

    override fun onGuidedActionEditedAndProceed(action: GuidedAction): Long {
        when (action.id) {
            ID_SERVER -> PreferencesManager.serverUrl = action.description?.toString().orEmpty()
            ID_LAYOUT -> PreferencesManager.selectedLayout = action.description?.toString().orEmpty()
            ID_SECONDARY -> PreferencesManager.secondaryLayout = action.description?.toString().orEmpty()
            ID_GENRE -> PreferencesManager.genreFilter = action.description?.toString().orEmpty()
            ID_AGE -> PreferencesManager.ageFilter = action.description?.toString().orEmpty()
            ID_YEAR -> PreferencesManager.yearFilter = action.description?.toString().orEmpty()
        }
        (activity as? SettingsActivity)?.requestWallpaperUpdate()
        return super.onGuidedActionEditedAndProceed(action)
    }

    override fun onSubGuidedActionClicked(action: GuidedAction): Boolean {
        val parent = selectedAction ?: return true
        val label = action.title?.toString().orEmpty()
        when (parent.id) {
            ID_PICK -> {
                val mode = WallpaperPickModes.ALL.firstOrNull { it.label == label }
                if (mode != null) PreferencesManager.wallpaperPickMode = mode.id
            }
            ID_CLIENT -> {
                val client = ClientIntents.SUPPORTED.firstOrNull { it.name == label }
                if (client != null) PreferencesManager.preferredClient = client.packageName
            }
        }
        parent.description = label
        notifyActionChanged(selectedActionPosition)
        (activity as? SettingsActivity)?.requestWallpaperUpdate()
        return true
    }

    private fun editable(id: Long, title: String, value: String) =
        GuidedAction.Builder(context)
            .id(id)
            .title(title)
            .description(value)
            .descriptionEditable(true)
            .build()

    private fun listAction(id: Long, title: String, value: String, options: List<String>): GuidedAction {
        val subs = options.mapIndexed { index, label ->
            GuidedAction.Builder(context).id(id * 100 + index).title(label).build()
        }
        return GuidedAction.Builder(context)
            .id(id)
            .title(title)
            .description(value)
            .subActions(subs)
            .build()
    }

    companion object {
        private const val ID_SERVER = 1L
        private const val ID_LAYOUT = 2L
        private const val ID_PICK = 3L
        private const val ID_MOTION = 4L
        private const val ID_SECONDARY = 5L
        private const val ID_GENRE = 6L
        private const val ID_AGE = 7L
        private const val ID_YEAR = 8L
        private const val ID_CLIENT = 9L
        private const val ID_IDLE = 10L
    }
}
