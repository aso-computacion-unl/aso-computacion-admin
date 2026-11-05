/** Query flag `createEvent` puts on the edit page's URL; the page confirms the creation once and then drops it. */
export const CREATED_FLAG = "creado";

/** The id of the Photos section of the edit page, also the URL hash the redirect aims at. */
export const PHOTOS_SECTION_ID = "fotos";

/** Where creating an event lands: its edit page, flagged as just created and aimed at the Photos section. */
export const createdEventPath = (editPath: string) => `${editPath}?${CREATED_FLAG}=1#${PHOTOS_SECTION_ID}`;
