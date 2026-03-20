"use client";

import type { ActivityType, ConferenceMetadata, SocialEventMetadata } from "@/features/activities/types";
import ConferenceFields from "./ConferenceFields";
import RoadTripFields from "./RoadTripFields";
import DinnerFields from "./DinnerFields";

interface DistrictStop {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  visitDate: string;
  notes: string;
}

interface EventTypeFieldsProps {
  type: ActivityType;
  metadata: Record<string, unknown>;
  onMetadataChange: (metadata: Record<string, unknown>) => void;
  districtStops: DistrictStop[];
  onDistrictStopsChange: (stops: DistrictStop[]) => void;
}

export default function EventTypeFields({
  type,
  metadata,
  onMetadataChange,
  districtStops,
  onDistrictStopsChange,
}: EventTypeFieldsProps) {
  switch (type) {
    case "conference":
      return (
        <ConferenceFields
          metadata={metadata as ConferenceMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    case "road_trip":
      return (
        <RoadTripFields
          districtStops={districtStops}
          onDistrictStopsChange={onDistrictStopsChange}
        />
      );

    case "dinner":
    case "happy_hour":
    case "school_site_visit":
    case "fun_and_games":
      return (
        <DinnerFields
          metadata={metadata as SocialEventMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    default:
      return null;
  }
}
