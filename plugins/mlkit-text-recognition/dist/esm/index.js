import { registerPlugin } from '@capacitor/core';
const TextRecognition = registerPlugin('TextRecognition', {
    web: () => import('./web').then(m => new m.TextRecognitionWeb()),
});
export * from './definitions';
export { TextRecognition };
//# sourceMappingURL=index.js.map