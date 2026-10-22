import type { Event } from "@/domain/event";
import type { EventPhoto } from "@/domain/event-photo";

import type { EventPhotoResult, EventResult } from "../dto/event-result.dto";

export function toEventResult(event: Event): EventResult {
  return { ...event.props, highlights: [...event.props.highlights] };
}

export function toEventPhotoResult(photo: EventPhoto): EventPhotoResult {
  return { ...photo.props };
}
