package com.imanunator.wallpaparr

import android.os.Bundle
import androidx.leanback.app.GuidedStepSupportFragment
import androidx.leanback.widget.GuidanceStylist
import androidx.leanback.widget.GuidedAction
import com.imanunator.wallpaparr.core.ClientIntents
import com.imanunator.wallpaparr.core.WallpaperPickModes

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
        actions += editable(ID_LAYOUT, "Primary layout / collection", PreferencesManager.selectedLayout)
        actions += editable(ID_SECONDARY, "Secondary layout (mix modes)", PreferencesManager.secondaryLayout)
        actions += editable(ID_THIRD, "Third layout (round-robin)", PreferencesManager.thirdLayout)
        actions += listAction(
            ID_PICK,
            "Wallpaper pick mode",
            WallpaperPickModes.labelFor(PreferencesManager.wallpaperPickMode),
            WallpaperPickModes.ALL.map { "${it.group}: ${it.label}" },
        )
        actions += editable(ID_GENRE, "Genre filter (comma)", PreferencesManager.genreFilter)
        actions += editable(ID_AGE, "Age rating filter", PreferencesManager.ageFilter)
        actions += editable(ID_YEAR, "Year or range (2005-2010)", PreferencesManager.yearFilter)
        actions += editable(ID_MIN_RATING, "Minimum rating (0-10)", PreferencesManager.minRating.toString())
        actions += editable(ID_MAX_RATING, "Maximum rating (0-10)", PreferencesManager.maxRating.toString())
        actions += editable(ID_MIX, "Weighted mix % newest (0-100)", PreferencesManager.mixRatio.toString())
        actions += editable(ID_RECENT, "Recent-years window", PreferencesManager.recentYears.toString())
        actions += editable(ID_EXCLUDE, "No-repeat bag depth", PreferencesManager.excludeDepth.toString())
        actions += GuidedAction.Builder(context)
            .id(ID_MOTION)
            .title("Prefer parallax / motion VIDEO")
            .description("Use baked MP4 when the suite provides videoUrl")
            .checkSetId(GuidedAction.CHECKBOX_CHECK_SET_ID)
            .checked(PreferencesManager.preferMotion)
            .build()
        actions += GuidedAction.Builder(context)
            .id(ID_FALLBACK)
            .title("Fallback to still JPEG")
            .description("If no MP4, use imageUrl")
            .checkSetId(GuidedAction.CHECKBOX_CHECK_SET_ID)
            .checked(PreferencesManager.fallbackStill)
            .build()
        actions += listAction(
            ID_CLIENT,
            "Preferred client / deep link",
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
            ID_FALLBACK -> PreferencesManager.fallbackStill = action.isChecked
            ID_IDLE -> PreferencesManager.refreshOnIdleExit = action.isChecked
        }
        (activity as? SettingsActivity)?.requestWallpaperUpdate()
    }

    override fun onGuidedActionEditedAndProceed(action: GuidedAction): Long {
        val text = action.description?.toString().orEmpty()
        when (action.id) {
            ID_SERVER -> PreferencesManager.serverUrl = text
            ID_LAYOUT -> PreferencesManager.selectedLayout = text
            ID_SECONDARY -> PreferencesManager.secondaryLayout = text
            ID_THIRD -> PreferencesManager.thirdLayout = text
            ID_GENRE -> PreferencesManager.genreFilter = text
            ID_AGE -> PreferencesManager.ageFilter = text
            ID_YEAR -> PreferencesManager.yearFilter = text
            ID_MIN_RATING -> PreferencesManager.minRating = text.toFloatOrNull() ?: 0f
            ID_MAX_RATING -> PreferencesManager.maxRating = text.toFloatOrNull() ?: 10f
            ID_MIX -> PreferencesManager.mixRatio = text.toIntOrNull()?.coerceIn(0, 100) ?: 30
            ID_RECENT -> PreferencesManager.recentYears = text.toIntOrNull()?.coerceIn(1, 50) ?: 3
            ID_EXCLUDE -> PreferencesManager.excludeDepth = text.toIntOrNull()?.coerceIn(1, 50) ?: 5
        }
        (activity as? SettingsActivity)?.requestWallpaperUpdate()
        return super.onGuidedActionEditedAndProceed(action)
    }

    override fun onSubGuidedActionClicked(action: GuidedAction): Boolean {
        val parentId = action.id / 100
        val label = action.title?.toString().orEmpty()
        when (parentId) {
            ID_PICK -> {
                val name = label.substringAfter(": ").ifBlank { label }
                val mode = WallpaperPickModes.ALL.firstOrNull { it.label == name }
                if (mode != null) PreferencesManager.wallpaperPickMode = mode.id
            }
            ID_CLIENT -> {
                val client = ClientIntents.SUPPORTED.firstOrNull { it.name == label }
                if (client != null) PreferencesManager.preferredClient = client.packageName
            }
        }
        val parentPos = selectedActionPosition
        if (parentPos >= 0) {
            val parent = actions.get(parentPos) as? GuidedAction
            if (parent != null) {
                parent.description = label
                notifyActionChanged(parentPos)
            }
        }
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
        private const val ID_THIRD = 11L
        private const val ID_MIX = 12L
        private const val ID_RECENT = 13L
        private const val ID_EXCLUDE = 14L
        private const val ID_MIN_RATING = 15L
        private const val ID_MAX_RATING = 16L
        private const val ID_FALLBACK = 17L
    }
}
