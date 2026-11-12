import type { ReminderMessageBuilder } from "@/application";

/**
 * The same builder, telling `report` about the first message of the run that cannot be built. The run counts such a
 * message as failed and goes on, so without this a run where no link can be signed ends `done` and nobody hears of
 * it. Once per run: the cause (the server's secret) is the same for everyone, and the error carries no personal data.
 */
export function reportingFirstBuildFailure(build: ReminderMessageBuilder, report: (error: unknown) => void): ReminderMessageBuilder {
  let reported = false;

  return async (event, person) => {
    try {
      return await build(event, person);
    } catch (error) {
      if (!reported) {
        reported = true;
        report(error);
      }

      throw error;
    }
  };
}
