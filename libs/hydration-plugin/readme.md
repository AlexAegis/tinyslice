# Hydration Plugin

This plugin injects state when registered and persists it as long as it's running.

Since plugins can be attached to any slice if you only want to persist some
slices, just add the plugin at those slices and not to the root one. Just make
sure they don't write to the same `localStorage` key.

## Migrations

Migrations can be defined on the plugin, if one finds and entry based on the
migrations `fromKey`, it will run the migration function, save the result to
`toKey` and remove `fromKey`. All `remove`, `getter` and `setter` functions
can be overriden for each separate migration to allow migrating from
and to different storages.

Only successful migrations delete the original entry and migrations are ran
behind a try/catch block. So if you change your cache-key to invalidate
the users state but you forgot a migration, you can retrieve it later.

When a migration finds something already at the target key it passes it to
your migrate function, allowing for merging.
