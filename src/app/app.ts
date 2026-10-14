import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  /** In a browser (web demo, ng serve) the app is drawn in a phone-sized frame on wide screens. */
  protected readonly native = Capacitor.isNativePlatform();
}
