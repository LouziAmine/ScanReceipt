import { CapacitorException, ExceptionCode, WebPlugin } from '@capacitor/core';
export class TextRecognitionWeb extends WebPlugin {
    async processImage(_options) {
        throw this.createUnimplementedException();
    }
    createUnimplementedException() {
        return new CapacitorException('This method is not implemented on web.', ExceptionCode.Unimplemented);
    }
}
//# sourceMappingURL=web.js.map