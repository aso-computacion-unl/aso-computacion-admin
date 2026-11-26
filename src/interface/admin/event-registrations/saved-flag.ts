/** Query flag `openEventRegistration` puts on the panel's URL; the panel confirms the save once and then drops it. */
export const SAVED_FLAG = "guardada";

const REGISTRATIONS_PATH = "/admin/registrations";

/** The panel with this event selected. */
export const registrationsPanelPath = (eventId: string) => `${REGISTRATIONS_PATH}?evento=${encodeURIComponent(eventId)}`;

/** Where opening a registration lands: the panel with that event selected, flagged as just saved. */
export const savedRegistrationPath = (eventId: string) => `${registrationsPanelPath(eventId)}&${SAVED_FLAG}=1`;
