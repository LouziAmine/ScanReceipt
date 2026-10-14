import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { t } from '../i18n/i18n';
import { FeedbackService } from './feedback.service';

/** Chromium's install prompt (Android, desktop). Not in the DOM typings yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/**
 * The browser demo as an installable app (PWA): it can be added to the home screen and opens
 * offline, thanks to the service worker of the `demo` build. Started once by the composition
 * root, so the install prompt the browser sends at load time is not missed.
 */
@Injectable({ providedIn: 'root' })
export class WebAppService {
  private readonly updates = inject(SwUpdate);
  private readonly feedback = inject(FeedbackService);
  private readonly prompt = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installed = signal(isStandalone());

  /**
   * Android and desktop Chrome, Edge…: the "Install" button opens the browser's dialog.
   * iPhone and iPad browsers have no dialog: the button shows the steps of the Share menu.
   */
  readonly canInstall = computed(
    () => !this.installed() && (this.prompt() !== null || iosBrowser() !== null),
  );

  constructor() {
    const onPrompt = (event: Event): void => {
      // Keeps the browser's mini-bar away; the app shows its own button instead.
      event.preventDefault();
      this.prompt.set(event as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      this.installed.set(true);
      this.prompt.set(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const versions = this.updates.isEnabled
      ? this.updates.versionUpdates.subscribe((event) => {
          if (event.type === 'VERSION_READY') void this.offerReload();
        })
      : undefined;
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      versions?.unsubscribe();
    });
  }

  async install(): Promise<void> {
    const prompt = this.prompt();
    if (prompt === null) {
      await this.showIosSteps();
      return;
    }
    // A prompt can be shown only once: the next one comes with the next page load.
    this.prompt.set(null);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') this.installed.set(true);
  }

  private async showIosSteps(): Promise<void> {
    const browser = iosBrowser();
    if (browser === null) return;
    await this.feedback.steps(t('Install the app'), [
      browser === 'safari'
        ? t('Tap the Share button (square with an arrow). If you do not see it, tap ••• first.')
        : browser === 'chrome'
          ? t('Tap the Share button in the address bar, at the top right.')
          : t("Open the browser's menu, then tap Share."),
      t('Choose Add to Home Screen. If it is not there, tap View More (⌄) first.'),
      t('Tap Add: ScanReceipt is on your home screen and opens offline.'),
    ]);
  }

  private async offerReload(): Promise<void> {
    await this.feedback.action(t('A new version is ready'), t('Reload'), () => {
      document.location.reload();
    });
  }
}

/** Opened from the home screen icon, not in a browser tab. */
function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * The browser on an iPhone or iPad (iPadOS says "Macintosh" but has touch), or null elsewhere.
 * Every iOS browser can add a web app to the home screen since iOS 16.4.
 */
function iosBrowser(): 'safari' | 'chrome' | 'other' | null {
  const agent = navigator.userAgent;
  const apple =
    /iPhone|iPad|iPod/.test(agent) || (agent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (!apple) return null;
  if (agent.includes('CriOS')) return 'chrome';
  return /FxiOS|EdgiOS|OPiOS/.test(agent) ? 'other' : 'safari';
}
