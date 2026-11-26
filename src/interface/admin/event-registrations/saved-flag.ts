/** Query flag the registration actions put on the panel's URL; the panel confirms the save once and then drops it. */
export const SAVED_FLAG = "guardada";

export const REGISTRATIONS_PATH = "/admin/registrations";

/** The panel with this event selected. */
export const registrationsPanelPath = (eventId: string) => `${REGISTRATIONS_PATH}?evento=${encodeURIComponent(eventId)}`;

/** Where opening a registration lands: the panel with that event selected, flagged as just saved. */
export const savedRegistrationPath = (eventId: string) => `${registrationsPanelPath(eventId)}&${SAVED_FLAG}=1`;

/** The flag's value for a registration just turned off: its event is no longer in the panel. */
export const TURNED_OFF = "desactivada";

/** Where turning a registration off lands: the panel, flagged. */
export const turnedOffRegistrationPath = `${REGISTRATIONS_PATH}?${SAVED_FLAG}=${TURNED_OFF}`;
