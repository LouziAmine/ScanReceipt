import { Directive, output } from '@angular/core';

const HOLD_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/** Emits when the element is held without moving; used to start multi-select. */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class LongPressDirective {
  readonly appLongPress = output();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private origin: { x: number; y: number } | null = null;

  protected start(event: PointerEvent): void {
    this.origin = { x: event.clientX, y: event.clientY };
    this.timer = setTimeout(() => {
      this.timer = null;
      this.appLongPress.emit();
    }, HOLD_MS);
  }

  protected move(event: PointerEvent): void {
    if (!this.origin) return;
    const moved = Math.hypot(event.clientX - this.origin.x, event.clientY - this.origin.y);
    if (moved > MOVE_TOLERANCE_PX) this.cancel();
  }

  protected cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.origin = null;
  }
}
