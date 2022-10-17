# Hydration Plugin

This plugin injects state when registered and persists it as long as it's running.

Since plugins can be attached to any slice if you only want to persist some
slices, just add the plugin at those slices and not to the root one. Just make
sure they don't write to the same `localStorage` key.
