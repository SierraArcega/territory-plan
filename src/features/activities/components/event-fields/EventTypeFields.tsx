"use client";

import type {
  ActivityType,
  ConferenceMetadata,
  SocialEventMetadata,
  WebinarMetadata,
  SpeakingEngagementMetadata,
  ProfessionalDevelopmentMetadata,
  CourseMetadata,
} from "@/features/activities/types";
import ConferenceFields from "./ConferenceFields";
import RoadTripFields from "./RoadTripFields";
import DinnerFields from "./DinnerFields";
import WebinarFields from "./WebinarFields";
import SpeakingEngagementFields from "./SpeakingEngagementFields";
import ProfessionalDevelopmentFields from "./ProfessionalDevelopmentFields";
import CourseFields from "./CourseFields";

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

    case "webinar":
      return (
        <WebinarFields
          metadata={metadata as WebinarMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    case "speaking_engagement":
      return (
        <SpeakingEngagementFields
          metadata={metadata as SpeakingEngagementMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    case "professional_development":
      return (
        <ProfessionalDevelopmentFields
          metadata={metadata as ProfessionalDevelopmentMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    case "course":
      return (
        <CourseFields
          metadata={metadata as CourseMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    default:
      return null;
  }
}
