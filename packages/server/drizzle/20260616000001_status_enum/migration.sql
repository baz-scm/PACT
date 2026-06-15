ALTER TABLE plan_series ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
UPDATE plan_series SET status = CASE
  WHEN delisted = 1 THEN 'delisted'
  WHEN implemented = 1 THEN 'implemented'
  WHEN approved = 1 THEN 'approved'
  WHEN building_consensus = 1 THEN 'building_consensus'
  ELSE 'pending'
END;
ALTER TABLE plan_series DROP COLUMN delisted;
ALTER TABLE plan_series DROP COLUMN approved;
ALTER TABLE plan_series DROP COLUMN building_consensus;
ALTER TABLE plan_series DROP COLUMN implemented;
