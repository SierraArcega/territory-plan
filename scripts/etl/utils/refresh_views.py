"""Refresh materialized views after ETL data changes."""

import psycopg2


def refresh_map_features(connection_string: str):
    """
    Refresh the district_map_features materialized view.

    Call this after any ETL that modifies data used by the view:
    - competitor_spend (vendor categories)
    - districts (fullmind revenue, geometry, ownership)
    - territory_plan_districts (plan memberships)
    """
    conn = psycopg2.connect(connection_string)
    conn.set_isolation_level(0)  # autocommit required for REFRESH
    cur = conn.cursor()
    print("Refreshing district_map_features materialized view...")
    cur.execute("REFRESH MATERIALIZED VIEW district_map_features")
    print("district_map_features refreshed.")
    cur.close()
    conn.close()
