#target photoshop

(function () {
    var outputFolder = new Folder($.getenv("SNHS_SMOKE_OUTPUT"));
    var resultFile = new File(outputFolder.fsName + "/result.json");
    var doc = null;

    function escapeJson(value) {
        return String(value).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    }

    function writeResult(success, stage, details, psdPath, jpgPath) {
        resultFile.encoding = "UTF8";
        resultFile.open("w");
        resultFile.write("{\"success\":" + (success ? "true" : "false") +
            ",\"stage\":\"" + escapeJson(stage) + "\"" +
            ",\"details\":\"" + escapeJson(details) + "\"" +
            ",\"psdPath\":\"" + escapeJson(psdPath || "") + "\"" +
            ",\"jpgPath\":\"" + escapeJson(jpgPath || "") + "\"}");
        resultFile.close();
    }

    try {
        if (!outputFolder.exists && !outputFolder.create()) {
            throw new Error("Could not create smoke output directory: " + outputFolder.fsName);
        }
        app.displayDialogs = DialogModes.NO;
        doc = app.documents.add(800, 600, 72, "SNHS_AUTOMATION_TEST", NewDocumentMode.RGB, DocumentFill.WHITE);
        doc.activeLayer.name = "BACKGROUND";

        var textLayer = doc.artLayers.add();
        textLayer.name = "AUTOMATION_TEST_TEXT";
        textLayer.kind = LayerKind.TEXT;
        textLayer.textItem.contents = "SNHS AUTOMATION TEST";
        textLayer.textItem.position = [115, 320];
        textLayer.textItem.size = 44;
        textLayer.textItem.font = "Arial-BoldMT";
        var textColor = new SolidColor();
        textColor.rgb.red = 12;
        textColor.rgb.green = 42;
        textColor.rgb.blue = 92;
        textLayer.textItem.color = textColor;

        var psdFile = new File(outputFolder.fsName + "/SNHS_AUTOMATION_TEST.psd");
        var jpgFile = new File(outputFolder.fsName + "/SNHS_AUTOMATION_TEST.jpg");
        doc.saveAs(psdFile, new PhotoshopSaveOptions(), true, Extension.LOWERCASE);
        var jpgOptions = new JPEGSaveOptions();
        jpgOptions.quality = 11;
        doc.saveAs(jpgFile, jpgOptions, true, Extension.LOWERCASE);
        writeResult(true, "completed", "Photoshop created the PSD and JPG.", psdFile.fsName, jpgFile.fsName);
    } catch (error) {
        writeResult(false, "jsx", error.message || String(error), "", "");
    } finally {
        if (doc !== null) {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
        }
    }
}());
