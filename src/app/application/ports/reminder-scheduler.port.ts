export abstract class ReminderScheduler {
  /** Resolves false when the person refuses notifications. */
  abstract scheduleMonthlyBackupReminder(): Promise<boolean>;
  abstract cancelBackupReminder(): Promise<void>;
}
