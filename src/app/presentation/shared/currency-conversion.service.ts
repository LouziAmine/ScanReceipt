import { Injectable, inject } from '@angular/core';
import { ExchangeRateQuery, type ReceiptFormValue, SettingsStore } from '@application';
import { type CurrencyCode, type Receipt, localDayKey, parseAmount } from '@domain';
import { AlertController } from '@ionic/angular/alert-controller';
import { dateFormat } from '../i18n/formats';
import { t } from '../i18n/i18n';
import { formatMoney } from './amounts';
import { FeedbackService } from './feedback.service';

/**
 * Receipts are kept in the person's currency. Before saving one paid in another currency, this
 * asks to convert it: at the purchase day's rate when online, or with the amount the person
 * types (from their bank statement) when the rate cannot be downloaded.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyConversionService {
  private readonly settings = inject(SettingsStore);
  private readonly rates = inject(ExchangeRateQuery);
  private readonly alerts = inject(AlertController);
  private readonly feedback = inject(FeedbackService);

  /**
   * The value to save: unchanged in the person's currency, otherwise converted once they
   * confirm. Resolves null when they cancel. `edited`: the receipt being edited, whose rate is
   * reused while its currency and purchase day stay the same.
   */
  async toPersonCurrency(
    value: ReceiptFormValue,
    edited?: Receipt | null,
  ): Promise<ReceiptFormValue | null> {
    const to = this.settings.currency();
    if (value.currency === to) return value;
    const rate =
      keptRate(value, to, edited) ??
      (await this.feedback.busy(t('Getting the exchange rate…'), () =>
        this.rates.rate(value.currency, to, value.purchasedAt),
      ));
    return rate ? this.confirmRate(value, to, rate) : this.askAmount(value, to);
  }

  private async confirmRate(
    value: ReceiptFormValue,
    to: CurrencyCode,
    rate: number,
  ): Promise<ReceiptFormValue | null> {
    const day = dateFormat({ month: 'short', day: 'numeric', year: 'numeric' });
    const alert = await this.alerts.create({
      header: t('Convert to {currency}?', { currency: to }),
      message: t(
        'This receipt is in {from}. It is saved in {to}, at the rate of {date}: {paid} = {converted}.',
        {
          from: value.currency,
          to,
          date: day.format(value.purchasedAt),
          paid: formatMoney(value.totalCents, value.currency),
          converted: formatMoney(Math.round(value.totalCents * rate), to),
        },
      ),
      buttons: [
        { text: t('Cancel'), role: 'cancel' },
        { text: t('Convert and save'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm' ? { ...value, conversion: { currency: to, rate } } : null;
  }

  private async askAmount(
    value: ReceiptFormValue,
    to: CurrencyCode,
  ): Promise<ReceiptFormValue | null> {
    const alert = await this.alerts.create({
      header: t('Convert to {currency}?', { currency: to }),
      message: t(
        'The exchange rate needs internet. Type what {paid} came to in {currency}, as on your bank statement.',
        { paid: formatMoney(value.totalCents, value.currency), currency: to },
      ),
      inputs: [
        {
          name: 'amount',
          type: 'text',
          placeholder: t('Amount in {currency}', { currency: to }),
          attributes: { inputmode: 'decimal' },
        },
      ],
      buttons: [
        { text: t('Cancel'), role: 'cancel' },
        { text: t('Convert and save'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { amount?: string } }>();
    if (role !== 'confirm') return null;
    const cents = parseAmount(data?.values?.amount ?? '');
    if (cents === null || cents <= 0 || value.totalCents <= 0) {
      await this.feedback.toast(t('Type the amount in {currency}.', { currency: to }));
      return null;
    }
    return { ...value, conversion: { currency: to, rate: cents / value.totalCents } };
  }
}

/** The rate an edited receipt was converted at, while it still applies. */
function keptRate(
  value: ReceiptFormValue,
  to: CurrencyCode,
  edited?: Receipt | null,
): number | null {
  const original = edited?.original;
  return original &&
    edited.currency === to &&
    original.total.currency === value.currency &&
    localDayKey(edited.purchasedAt) === localDayKey(value.purchasedAt)
    ? original.rate
    : null;
}
