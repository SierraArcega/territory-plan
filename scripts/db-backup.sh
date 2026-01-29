#!/bin/bash
#
# Database Backup & Restore Script
#
# Usage:
#   ./scripts/db-backup.sh backup              # Create timestamped backup
#   ./scripts/db-backup.sh backup mybackup     # Create named backup
#   ./scripts/db-backup.sh restore <file>      # Restore from backup
#   ./scripts/db-backup.sh list                # List available backups
#   ./scripts/db-backup.sh verify              # Verify current data state
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER_NAME="territory-plan-db-1"
DB_NAME="territory_plan"
DB_USER="territory"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if docker container is running
check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}Error: Database container '$CONTAINER_NAME' is not running${NC}"
        echo "Start it with: docker-compose up -d"
        exit 1
    fi
}

# Backup function
backup() {
    check_container

    local name="${1:-$(date +%Y%m%d_%H%M%S)}"
    local backup_file="$BACKUP_DIR/${name}.dump"

    echo -e "${YELLOW}Creating backup: $backup_file${NC}"

    # Use pg_dump with custom format (supports parallel restore, compression)
    docker exec "$CONTAINER_NAME" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -Fc \
        --no-owner \
        --no-acl \
        > "$backup_file"

    local size=$(du -h "$backup_file" | cut -f1)
    echo -e "${GREEN}✓ Backup created: $backup_file ($size)${NC}"

    # Show what's in the backup
    echo ""
    echo "Backup contents:"
    docker exec "$CONTAINER_NAME" pg_restore --list "$backup_file" 2>/dev/null | grep -E "TABLE|INDEX" | head -20 || true
}

# Restore function
restore() {
    check_container

    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        echo -e "${RED}Error: Please specify a backup file${NC}"
        echo "Usage: $0 restore <backup_file>"
        echo ""
        list
        exit 1
    fi

    # Handle relative paths
    if [[ ! "$backup_file" = /* ]]; then
        if [ -f "$BACKUP_DIR/$backup_file" ]; then
            backup_file="$BACKUP_DIR/$backup_file"
        elif [ -f "$BACKUP_DIR/${backup_file}.dump" ]; then
            backup_file="$BACKUP_DIR/${backup_file}.dump"
        fi
    fi

    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Error: Backup file not found: $backup_file${NC}"
        exit 1
    fi

    echo -e "${YELLOW}WARNING: This will replace ALL data in the database!${NC}"
    read -p "Are you sure you want to restore from $backup_file? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi

    echo -e "${YELLOW}Restoring from: $backup_file${NC}"

    # Drop and recreate schema (clean restore)
    echo "Dropping existing tables..."
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO $DB_USER;
        CREATE EXTENSION IF NOT EXISTS postgis;
    " > /dev/null

    # Restore from backup
    echo "Restoring data..."
    cat "$backup_file" | docker exec -i "$CONTAINER_NAME" pg_restore \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --single-transaction \
        2>&1 | grep -v "already exists" || true

    echo -e "${GREEN}✓ Restore complete${NC}"

    # Verify
    verify
}

# List backups
list() {
    echo -e "${YELLOW}Available backups:${NC}"
    echo ""

    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR"/*.dump 2>/dev/null)" ]; then
        for f in "$BACKUP_DIR"/*.dump; do
            local name=$(basename "$f")
            local size=$(du -h "$f" | cut -f1)
            local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || stat -c "%y" "$f" 2>/dev/null | cut -d'.' -f1)
            printf "  %-30s %8s  %s\n" "$name" "$size" "$date"
        done
    else
        echo "  No backups found."
        echo ""
        echo "Create one with: $0 backup"
    fi
}

# Verify database state
verify() {
    check_container

    echo -e "${YELLOW}Verifying database state...${NC}"
    echo ""

    # Run verification query
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
        SELECT
            'Districts' as data_type,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE geometry IS NOT NULL) as with_geometry
        FROM districts
        UNION ALL
        SELECT
            'Education Data',
            COUNT(*),
            COUNT(*) FILTER (WHERE salaries_total IS NOT NULL)
        FROM district_education_data
        UNION ALL
        SELECT
            'Demographics',
            COUNT(*),
            COUNT(*) FILTER (WHERE total_enrollment IS NOT NULL)
        FROM district_enrollment_demographics
        UNION ALL
        SELECT
            'Fullmind Data',
            COUNT(*),
            COUNT(*) FILTER (WHERE is_customer = true)
        FROM fullmind_data;
    " | while IFS='|' read -r type total extra; do
        printf "  %-20s %s records" "$type:" "$total"
        if [ -n "$extra" ] && [ "$extra" != "$total" ]; then
            printf " (%s enriched)" "$extra"
        fi
        echo ""
    done

    echo ""

    # Check for missing data
    local issues=0

    local edu_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT COUNT(*) FROM district_education_data WHERE salaries_total IS NOT NULL")

    if [ "$edu_count" -lt 1000 ]; then
        echo -e "${RED}⚠ Warning: Education data appears incomplete ($edu_count records with salary data)${NC}"
        echo "  Run: cd scripts/etl && python run_etl.py --education-data --year 2020"
        issues=1
    fi

    local demo_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT COUNT(*) FROM district_enrollment_demographics WHERE total_enrollment IS NOT NULL")

    if [ "$demo_count" -lt 1000 ]; then
        echo -e "${RED}⚠ Warning: Demographics data appears incomplete ($demo_count records)${NC}"
        echo "  Run: cd scripts/etl && python run_etl.py --demographics"
        issues=1
    fi

    if [ "$issues" -eq 0 ]; then
        echo -e "${GREEN}✓ Database appears healthy${NC}"
    fi
}

# Main
case "${1:-}" in
    backup)
        backup "$2"
        ;;
    restore)
        restore "$2"
        ;;
    list)
        list
        ;;
    verify)
        verify
        ;;
    *)
        echo "Database Backup & Restore Script"
        echo ""
        echo "Usage:"
        echo "  $0 backup [name]     Create a backup (default: timestamped)"
        echo "  $0 restore <file>    Restore from a backup file"
        echo "  $0 list              List available backups"
        echo "  $0 verify            Verify current database state"
        echo ""
        echo "Examples:"
        echo "  $0 backup                    # Creates backups/20260129_143022.dump"
        echo "  $0 backup before-migration   # Creates backups/before-migration.dump"
        echo "  $0 restore 20260129_143022   # Restores from that backup"
        echo "  $0 verify                    # Checks data completeness"
        ;;
esac
