/** The email is already registered as a user. */
export class UserEmailTakenError extends Error {
  constructor() {
    super("User email already registered");
    this.name = "UserEmailTakenError";
  }
}

/** The change would leave the admin without an active ADMIN, locking everyone out of user management. */
export class LastAdminError extends Error {
  constructor() {
    super("Cannot remove or demote the last active admin");
    this.name = "LastAdminError";
  }
}
