import { Injectable } from '@angular/core';
import { ReminderScheduler } from '@application';
import { LocalNotifications } from '@capacitor/local-notifications';

const BACKUP_REMINDER_ID = 4101;

/** Adapter: a local notification on the 1st of every month. No server involved. */
@Injectable()
export class LocalNotificationReminders extends ReminderScheduler {
  async scheduleMonthlyBackupReminder(): Promise<boolean> {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      return false;
    }
    await this.cancelBackupReminder();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BACKUP_REMINDER_ID,
          title: 'Time to back up your receipts',
          body: 'Your receipts live only on this phone. A backup takes a few seconds.',
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
