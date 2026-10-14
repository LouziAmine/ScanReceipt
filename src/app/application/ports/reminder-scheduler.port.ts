/** What the reminder says, already in the person's language. */
export interface ReminderText {
  readonly title: string;
  readonly body: string;
}

export abstract class ReminderScheduler {
  /** Resolves false when the person refuses notifications. Replaces any earlier reminder. */
  abstract scheduleMonthlyBackupReminder(text: ReminderText): Promise<boolean>;
  abstract cancelBackupReminder(): Promise<void>;
}
