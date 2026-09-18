package com.imanunator.projectivy.livewallpaper

import com.imanunator.projectivy.livewallpaper.core.UrlSupport
import org.junit.Assert.assertEquals
import org.junit.Test

class UrlBridgeTest {
    @Test
    fun pluginUsesSameNormalizerAsCore() {
        assertEquals("http://tv.local:8787/", UrlSupport.normalizeServerUrl("tv.local:8787"))
    }
}
