/** Plain shape returned by free-command use cases; mirrors `TerminalCommandProps` without exposing the entity. */
export interface TerminalCommandResult {
  id: string;
  command: string;
  description: string;
  output: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
