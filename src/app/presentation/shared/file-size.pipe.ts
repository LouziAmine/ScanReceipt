import { Pipe, type PipeTransform } from '@angular/core';

/** 62_000_000 -> "62 MB". */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit++;
    }
    return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit] ?? 'B'}`;
  }
}
