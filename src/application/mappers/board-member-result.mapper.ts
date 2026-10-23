import type { BoardMember } from "@/domain/board-member";

import type { BoardMemberResult } from "../dto/board-member-result.dto";

export function toBoardMemberResult({ props }: BoardMember): BoardMemberResult {
  const { photo } = props;

  return {
    id: props.id,
    name: props.name,
    role: props.role,
    photo: photo && { url: photo.url, width: photo.width, height: photo.height, alt: photo.alt },
    sortOrder: props.sortOrder,
    isPublished: props.isPublished,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}
