-- Promote address (text + lat/lng) out of metadata into real columns so they
-- can be filtered/sorted/reported on, and add in_person as a real column.
-- in_person is nullable: NULL = unset, TRUE = in person, FALSE = virtual.

ALTER TABLE activities ADD COLUMN address TEXT;
ALTER TABLE activities ADD COLUMN address_lat DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN address_lng DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN in_person BOOLEAN;

-- Backfill from existing metadata. Empty-string addresses become NULL so the
-- column reflects "no address known" cleanly.
UPDATE activities
SET address = NULLIF(metadata->>'address', '')
WHERE metadata ? 'address';

UPDATE activities
SET address_lat = (metadata->>'addressLat')::double precision
WHERE metadata ? 'addressLat' AND metadata->>'addressLat' IS NOT NULL;

UPDATE activities
SET address_lng = (metadata->>'addressLng')::double precision
WHERE metadata ? 'addressLng' AND metadata->>'addressLng' IS NOT NULL;
