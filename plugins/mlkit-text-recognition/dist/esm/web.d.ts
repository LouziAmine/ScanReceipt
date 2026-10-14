import { WebPlugin } from '@capacitor/core';
import type { TextRecognitionPlugin, ProcessImageOptions, ProcessImageResult } from './definitions';
export declare class TextRecognitionWeb extends WebPlugin implements TextRecognitionPlugin {
    processImage(_options: ProcessImageOptions): Promise<ProcessImageResult>;
    private createUnimplementedException;
}
