package io.capawesome.capacitorjs.plugins.mlkit.textrecognition;

import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.TextRecognizerOptionsInterface;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import io.capawesome.capacitorjs.plugins.mlkit.textrecognition.classes.options.ProcessImageOptions;
import io.capawesome.capacitorjs.plugins.mlkit.textrecognition.classes.results.ProcessImageResult;
import io.capawesome.capacitorjs.plugins.mlkit.textrecognition.interfaces.NonEmptyResultCallback;

public class TextRecognition {

    @NonNull
    private final TextRecognitionPlugin plugin;

    public TextRecognition(@NonNull TextRecognitionPlugin plugin) {
        this.plugin = plugin;
    }

    public void processImage(@NonNull ProcessImageOptions options, @NonNull NonEmptyResultCallback<ProcessImageResult> callback) {
        InputImage inputImage = createInputImageFromFilePath(options.getPath());
        if (inputImage == null) {
            callback.error(new Exception(TextRecognitionPlugin.ERROR_LOAD_IMAGE_FAILED));
            return;
        }

        TextRecognizerOptionsInterface recognizerOptions = createRecognizerOptionsForScript(options.getScript());
        final TextRecognizer textRecognizer = com.google.mlkit.vision.text.TextRecognition.getClient(recognizerOptions);
        plugin.getActivity().runOnUiThread(() -> {
            textRecognizer
                .process(inputImage)
                .addOnSuccessListener(text -> {
                    textRecognizer.close();
                    ProcessImageResult result = new ProcessImageResult(text);
                    callback.success(result);
                })
                .addOnCanceledListener(() -> {
                    textRecognizer.close();
                    callback.error(new Exception(TextRecognitionPlugin.ERROR_PROCESS_IMAGE_CANCELED));
                })
                .addOnFailureListener(exception -> {
                    textRecognizer.close();
                    callback.error(exception);
                });
        });
    }

    @NonNull
    private TextRecognizerOptionsInterface createRecognizerOptionsForScript(@NonNull String script) {
        // ScanReceipt: Latin only. The other scripts' models are not bundled (see README.md).
        return TextRecognizerOptions.DEFAULT_OPTIONS;
    }

    @Nullable
    private InputImage createInputImageFromFilePath(@NonNull String path) {
        try {
            return InputImage.fromFilePath(plugin.getContext(), Uri.parse(path));
        } catch (Exception exception) {
            return null;
        }
    }
}
