# 04 — Room Storage and Recovery

The object stores `room_snapshot` plus monotonic `room_events`. State-changing commands mutate a clone, transactionally persist the journal and snapshot, reconcile the expected alarm, then broadcast. Constructor re-entry loads the snapshot, validates pinned versions and restores the alarm. Socket attachments contain only identity/version references.
