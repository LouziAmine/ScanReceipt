import { type ReminderText } from '@application';
import { t } from '../i18n/i18n';

/** The monthly backup notification, in the language of the screens. */
export function backupReminderText(): ReminderText {
  return {
    title: t('Time to back up your receipts'),
    body: t('Your receipts live only on this phone. A backup takes a few seconds.'),
  };
}
