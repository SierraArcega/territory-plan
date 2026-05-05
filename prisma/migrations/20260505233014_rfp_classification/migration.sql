ALTER TABLE rfps
  ADD COLUMN fullmind_relevance       varchar(10),
  ADD COLUMN keywords                 varchar(80)[]  NOT NULL DEFAULT '{}',
  ADD COLUMN funding_sources          varchar(40)[]  NOT NULL DEFAULT '{}',
  ADD COLUMN set_aside_type           varchar(20),
  ADD COLUMN in_state_only            boolean        NOT NULL DEFAULT false,
  ADD COLUMN cooperative_eligible     boolean        NOT NULL DEFAULT false,
  ADD COLUMN requires_w9_state        varchar(2),
  ADD COLUMN classified_at            timestamptz,
  ADD COLUMN district_pipeline_state  varchar(20),
  ADD COLUMN signals_refreshed_at     timestamptz;

ALTER TABLE rfps
  ADD CONSTRAINT rfps_fullmind_relevance_check
    CHECK (fullmind_relevance IS NULL
           OR fullmind_relevance IN ('high','medium','low','none')),
  ADD CONSTRAINT rfps_set_aside_type_check
    CHECK (set_aside_type IS NULL
           OR set_aside_type IN ('small_business','minority_owned','woman_owned',
                                 'veteran_owned','hub_zone','none')),
  ADD CONSTRAINT rfps_district_pipeline_state_check
    CHECK (district_pipeline_state IS NULL
           OR district_pipeline_state IN ('active','recently_won','recently_lost',
                                          'top_icp','cold'));

CREATE INDEX rfps_fullmind_relevance_due_date_idx
  ON rfps (fullmind_relevance, due_date);
CREATE INDEX rfps_classified_at_idx        ON rfps (classified_at);
CREATE INDEX rfps_signals_refreshed_at_idx ON rfps (signals_refreshed_at);
