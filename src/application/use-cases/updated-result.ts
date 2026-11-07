/** What an update answers: the saved row plus whether the stored row was published BEFORE the save. */
export type Updated<Result> = Result & { wasPublished: boolean };
