package com.imanunator.wallpaparr

import android.os.Bundle
import androidx.leanback.app.GuidedStepSupportFragment
import androidx.leanback.widget.GuidanceStylist
import androidx.leanback.widget.GuidedAction
import com.imanunator.wallpaparr.core.ClientIntents
import com.imanunator.wallpaparr.core.PluginSettingsCopy
import com.imanunator.wallpaparr.core.SettingCopy
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

        actions += header(ID_HDR_CONNECTION, PluginSettingsCopy.CONNECTION)
        actions += editable(ID_SERVER, PluginSettingsCopy.SERVER, PreferencesManager.serverUrl)

        actions += header(ID_HDR_LAYOUTS, PluginSettingsCopy.LAYOUTS)
        actions += editable(ID_LAYOUT, PluginSettingsCopy.PRIMARY_LAYOUT, PreferencesManager.selectedLayout)
        actions += editable(ID_SECONDARY, PluginSettingsCopy.SECONDARY_LAYOUT, PreferencesManager.secondaryLayout)
        actions += editable(ID_THIRD, PluginSettingsCopy.THIRD_LAYOUT, PreferencesManager.thirdLayout)

        actions += header(ID_HDR_PICK, PluginSettingsCopy.WHAT_TO_SHOW)
        val selectedMode = WallpaperPickModes.byId(PreferencesManager.wallpaperPickMode)
        actions += listAction(
            ID_PICK,
            PluginSettingsCopy.PICK_MODE.title,
            selectedMode?.label ?: WallpaperPickModes.labelFor(PreferencesManager.wallpaperPickMode),
            WallpaperPickModes.ALL.map { it.label to "${it.group} · ${it.help}" },
        )

        actions += header(ID_HDR_FILTERS, PluginSettingsCopy.FILTERS)
        actions += editable(ID_GENRE, PluginSettingsCopy.GENRE, PreferencesManager.genreFilter)
        actions += editable(ID_AGE, PluginSettingsCopy.AGE, PreferencesManager.ageFilter)
        actions += editable(ID_YEAR, PluginSettingsCopy.YEAR, PreferencesManager.yearFilter)
        actions += editable(ID_MIN_RATING, PluginSettingsCopy.MIN_RATING, PreferencesManager.minRating.toString())
        actions += editable(ID_MAX_RATING, PluginSettingsCopy.MAX_RATING, PreferencesManager.maxRating.toString())

        actions += header(ID_HDR_MIX, PluginSettingsCopy.MIX)
        actions += editable(ID_MIX, PluginSettingsCopy.MIX_RATIO, PreferencesManager.mixRatio.toString())
        actions += editable(ID_RECENT, PluginSettingsCopy.RECENT_YEARS, PreferencesManager.recentYears.toString())
        actions += editable(ID_EXCLUDE, PluginSettingsCopy.EXCLUDE, PreferencesManager.excludeDepth.toString())

        actions += header(ID_HDR_MOTION, PluginSettingsCopy.MOTION)
        actions += checkbox(
            ID_MOTION,
            PluginSettingsCopy.PREFER_MOTION,
            PreferencesManager.preferMotion,
        )
        actions += checkbox(
            ID_FALLBACK,
            PluginSettingsCopy.FALLBACK_STILL,
            PreferencesManager.fallbackStill,
        )

        actions += header(ID_HDR_HOME, PluginSettingsCopy.HOME)
        val selectedClient = ClientIntents.SUPPORTED.firstOrNull {
            it.packageName == PreferencesManager.preferredClient
        }
        actions += listAction(
            ID_CLIENT,
            PluginSettingsCopy.CLIENT.title,
            selectedClient?.name ?: PreferencesManager.preferredClient,
            ClientIntents.SUPPORTED.map { it.name to it.help },
        )
        actions += checkbox(
            ID_IDLE,
            PluginSettingsCopy.IDLE,
            PreferencesManager.refreshOnIdleExit,
        )
    }

    override fun onGuidedActionClicked(action: GuidedAction) {
        when (action.id) {
            ID_MOTION -> PreferencesManager.preferMotion = action.isChecked
            ID_FALLBACK -> PreferencesManager.fallbackStill = action.isChecked
            ID_IDLE -> PreferencesManager.refreshOnIdleExit = action.isChecked
            else -> return
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
        val parentId = action.id / SUB_STRIDE
        val index = (action.id % SUB_STRIDE).toInt()
        val selectedLabel = when (parentId) {
            ID_PICK -> {
                val mode = WallpaperPickModes.at(index)
                if (mode != null) {
                    PreferencesManager.wallpaperPickMode = mode.id
                    mode.label
                } else {
                    action.title?.toString().orEmpty()
                }
            }
            ID_CLIENT -> {
                val client = ClientIntents.at(index)
                if (client != null) {
                    PreferencesManager.preferredClient = client.packageName
                    client.name
                } else {
                    action.title?.toString().orEmpty()
                }
            }
            else -> action.title?.toString().orEmpty()
        }
        val parentPos = selectedActionPosition
        if (parentPos >= 0) {
            val parent = actions.get(parentPos) as? GuidedAction
            if (parent != null) {
                parent.description = selectedLabel
                notifyActionChanged(parentPos)
            }
        }
        (activity as? SettingsActivity)?.requestWallpaperUpdate()
        return true
    }

    private fun header(id: Long, copy: SettingCopy) =
        GuidedAction.Builder(context)
            .id(id)
            .title(copy.title)
            .description(copy.hint)
            .infoOnly(true)
            .focusable(false)
            .multilineDescription(true)
            .build()

    private fun editable(id: Long, copy: SettingCopy, value: String) =
        GuidedAction.Builder(context)
            .id(id)
            .title(copy.title)
            .description(value)
            .editTitle("${copy.title} — ${copy.hint}")
            .descriptionEditable(true)
            .multilineDescription(true)
            .build()

    private fun checkbox(id: Long, copy: SettingCopy, checked: Boolean) =
        GuidedAction.Builder(context)
            .id(id)
            .title(copy.title)
            .description(copy.hint)
            .checkSetId(GuidedAction.CHECKBOX_CHECK_SET_ID)
            .checked(checked)
            .multilineDescription(true)
            .build()

    private fun listAction(
        id: Long,
        title: String,
        value: String,
        options: List<Pair<String, String>>,
    ): GuidedAction {
        val subs = options.mapIndexed { index, (label, help) ->
            GuidedAction.Builder(context)
                .id(id * SUB_STRIDE + index)
                .title(label)
                .description(help)
                .multilineDescription(true)
                .build()
        }
        return GuidedAction.Builder(context)
            .id(id)
            .title(title)
            .description(value)
            .subActions(subs)
            .multilineDescription(true)
            .build()
    }

    companion object {
        private const val SUB_STRIDE = 100L
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
        private const val ID_HDR_CONNECTION = 1001L
        private const val ID_HDR_LAYOUTS = 1002L
        private const val ID_HDR_PICK = 1003L
        private const val ID_HDR_FILTERS = 1004L
        private const val ID_HDR_MIX = 1005L
        private const val ID_HDR_MOTION = 1006L
        private const val ID_HDR_HOME = 1007L
    }
}
