import { Injectable } from '@angular/core';
import { ReminderScheduler, type ReminderText } from '@application';
import { LocalNotifications } from '@capacitor/local-notifications';

const BACKUP_REMINDER_ID = 4101;

/** Adapter: a local notification on the 1st of every month. No server involved. */
@Injectable()
export class LocalNotificationReminders extends ReminderScheduler {
  async scheduleMonthlyBackupReminder(text: ReminderText): Promise<boolean> {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      return false;
    }
    await this.cancelBackupReminder();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BACKUP_REMINDER_ID,
          title: text.title,
          body: text.body,
          schedule: { on: { day: 1, hour: 10, minute: 0 }, allowWhileIdle: true },
        },
      ],
    });
    return true;
  }

  async cancelBackupReminder(): Promise<void> {
    await LocalNotifications.cancel({ notifications: [{ id: BACKUP_REMINDER_ID }] });
  }
}
