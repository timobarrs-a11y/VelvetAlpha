/*
# Fix memory_history FK — allow history to survive item deletion

## Problem
The AFTER DELETE trigger on memory_items inserts a history row after
the memory_item is deleted. The FK constraint on memory_history.memory_id
fails because the referenced row is already gone.

## Fix
Drop the FK constraint on memory_history.memory_id. History rows should
persist as audit records even after the memory item is deleted. Replace
the FK with a plain btree index (already exists from the previous migration).
*/

ALTER TABLE memory_history DROP CONSTRAINT IF EXISTS memory_history_memory_id_fkey;