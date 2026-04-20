package com.vpass.brotherprintersdk

import android.util.Log
import com.brother.sdk.lmprinter.PrinterModel
import com.brother.sdk.lmprinter.setting.PrintImageSettings
import com.brother.sdk.lmprinter.setting.PrintSettings
import com.brother.sdk.lmprinter.setting.PTPrintSettings
import com.brother.sdk.lmprinter.setting.QLPrintSettings

class SettingsUtil private constructor() {
  companion object {
    private fun _findPrinterModelByEnumName(enumName: String): PrinterModel? {
      return try {
        PrinterModel.valueOf(enumName)
      } catch (_: IllegalArgumentException) {
        null
      }
    }

    private fun _resolvePtModel(name: String): PrinterModel? {
      val normalized = name.trim().uppercase().replace(" ", "")
      val candidateEnums = mutableListOf<String>()

      // Explicit fallback for PT-E920 family: this bundled Brother SDK does not expose PT_E920BT.
      if (normalized.startsWith("PT-E920BT")) {
        candidateEnums.add("PT_E560BT")
        candidateEnums.add("PT_E550W")
      }

      if (normalized.startsWith("PT-E560BT")) candidateEnums.add("PT_E560BT")
      if (normalized.startsWith("PT-E510")) candidateEnums.add("PT_E510")
      if (normalized.startsWith("PT-E310BT")) candidateEnums.add("PT_E310BT")
      if (normalized.startsWith("PT-E550W")) candidateEnums.add("PT_E550W")
      if (normalized.startsWith("PT-P710BT")) candidateEnums.add("PT_P710BT")
      if (normalized.startsWith("PT-P715EBT")) candidateEnums.add("PT_P715eBT")
      if (normalized.startsWith("PT-P910BT")) candidateEnums.add("PT_P910BT")
      if (normalized.startsWith("PT-P300BT")) candidateEnums.add("PT_P300BT")
      if (normalized.startsWith("PT-D410")) candidateEnums.add("PT_D410")
      if (normalized.startsWith("PT-D460BT")) candidateEnums.add("PT_D460BT")
      if (normalized.startsWith("PT-D610BT")) candidateEnums.add("PT_D610BT")

      for (candidate in candidateEnums) {
        val resolved = _findPrinterModelByEnumName(candidate)
        if (resolved != null) {
          Log.d("ExpoBrotherPrinterSdk", "_resolvePtModel - mapped $name to $candidate")
          return resolved
        }
      }

      return null
    }

    private fun _printerModelFromName(name: String): PrinterModel? {
      val normalized = name.trim().uppercase().replace(" ", "")

      if (normalized.startsWith("QL-710W")) {
        return PrinterModel.QL_710W
      }
      if (normalized.startsWith("QL-720NW")) {
        return PrinterModel.QL_720NW
      }
      if (normalized.startsWith("QL-810W")) {
        return PrinterModel.QL_810W
      }
      if (normalized.startsWith("QL-820NWB")) {
        return PrinterModel.QL_820NWB
      }
      if (normalized.startsWith("QL-1110NWB")) {
        return PrinterModel.QL_1110NWB
      }
      if (normalized.startsWith("QL-1115NWB")) {
        return PrinterModel.QL_1115NWB
      }

      if (normalized.startsWith("PT-")) {
        val ptModel = _resolvePtModel(name)
        if (ptModel != null) return ptModel
      }

      Log.d("ExpoBrotherPrinterSdk", "_printerModelFromName - No matching model found for: $name")
      return null;
    }

    private fun _labelSizeFromValue(value: Int): QLPrintSettings.LabelSize {
      return when (value) {
        0 -> QLPrintSettings.LabelSize.DieCutW17H54
        1 -> QLPrintSettings.LabelSize.DieCutW17H87
        2 -> QLPrintSettings.LabelSize.DieCutW23H23
        3 -> QLPrintSettings.LabelSize.DieCutW29H42
        4 -> QLPrintSettings.LabelSize.DieCutW29H90
        5 -> QLPrintSettings.LabelSize.DieCutW38H90
        6 -> QLPrintSettings.LabelSize.DieCutW39H48
        7 -> QLPrintSettings.LabelSize.DieCutW52H29
        8 -> QLPrintSettings.LabelSize.DieCutW62H29
        9 -> QLPrintSettings.LabelSize.DieCutW62H60
        10 -> QLPrintSettings.LabelSize.DieCutW62H75
        11 -> QLPrintSettings.LabelSize.DieCutW62H100
        12 -> QLPrintSettings.LabelSize.DieCutW60H86
        13 -> QLPrintSettings.LabelSize.DieCutW54H29
        14 -> QLPrintSettings.LabelSize.DieCutW102H51
        15 -> QLPrintSettings.LabelSize.DieCutW102H152
        16 -> QLPrintSettings.LabelSize.DieCutW103H164
        17 -> QLPrintSettings.LabelSize.RollW12
        18 -> QLPrintSettings.LabelSize.RollW29
        19 -> QLPrintSettings.LabelSize.RollW38
        20 -> QLPrintSettings.LabelSize.RollW50
        21 -> QLPrintSettings.LabelSize.RollW54
        22 -> QLPrintSettings.LabelSize.RollW62
        23 -> QLPrintSettings.LabelSize.RollW62RB
        24 -> QLPrintSettings.LabelSize.RollW102
        25 -> QLPrintSettings.LabelSize.RollW103
        26 -> QLPrintSettings.LabelSize.DTRollW90
        27 -> QLPrintSettings.LabelSize.DTRollW102
        28 -> QLPrintSettings.LabelSize.DTRollW102H51
        29 -> QLPrintSettings.LabelSize.DTRollW102H152
        30 -> QLPrintSettings.LabelSize.RoundW12DIA
        31 -> QLPrintSettings.LabelSize.RoundW24DIA
        32 -> QLPrintSettings.LabelSize.RoundW58DIA
        else -> QLPrintSettings.LabelSize.DieCutW62H29 // Default value
      }
    }

    private fun _ptLabelSizeFromValue(value: Int): PTPrintSettings.LabelSize {
      return when (value) {
        0 -> PTPrintSettings.LabelSize.Width3_5mm
        1 -> PTPrintSettings.LabelSize.Width6mm
        2 -> PTPrintSettings.LabelSize.Width9mm
        3, 17 -> PTPrintSettings.LabelSize.Width12mm
        4, 18 -> PTPrintSettings.LabelSize.Width18mm
        5, 19 -> PTPrintSettings.LabelSize.Width24mm
        6, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29 -> PTPrintSettings.LabelSize.Width36mm
        7 -> PTPrintSettings.LabelSize.WidthHS_5_8mm
        8 -> PTPrintSettings.LabelSize.WidthHS_8_8mm
        9 -> PTPrintSettings.LabelSize.WidthHS_11_7mm
        10 -> PTPrintSettings.LabelSize.WidthHS_17_7mm
        11 -> PTPrintSettings.LabelSize.WidthHS_23_6mm
        12 -> PTPrintSettings.LabelSize.WidthFL_21x45mm
        13 -> PTPrintSettings.LabelSize.WidthHS_5_2mm
        14 -> PTPrintSettings.LabelSize.WidthHS_9_0mm
        15 -> PTPrintSettings.LabelSize.WidthHS_11_2mm
        16 -> PTPrintSettings.LabelSize.WidthHS_21_0mm
        else -> PTPrintSettings.LabelSize.Width12mm
      }
    }

    private fun _resolutionFromValue(value: Int): PrintImageSettings.Resolution {
      return when (value) {
        0 -> PrintImageSettings.Resolution.Low
        1 -> PrintImageSettings.Resolution.Normal
        2 -> PrintImageSettings.Resolution.High
        else -> PrintImageSettings.Resolution.Normal // Default value
      }
    }

    private fun _rotationFromValue(value: Int): PrintImageSettings.Rotation {
      return when (value) {
        0 -> PrintImageSettings.Rotation.Rotate0
        1 -> PrintImageSettings.Rotation.Rotate90
        2 -> PrintImageSettings.Rotation.Rotate180
        3 -> PrintImageSettings.Rotation.Rotate270
        else -> PrintImageSettings.Rotation.Rotate0 // Default value
      }
    }

    private fun _halftoneFromValue(value: Int): PrintImageSettings.Halftone {
      return when (value) {
        0 -> PrintImageSettings.Halftone.Threshold
        1 -> PrintImageSettings.Halftone.ErrorDiffusion
        2 -> PrintImageSettings.Halftone.PatternDither
        else -> PrintImageSettings.Halftone.Threshold // Default value
      }
    }

    private fun _parseSettings_PTSeries(dictionary: Map<String, Any>, model: PrinterModel, workPath: String): PTPrintSettings {
      val settings = PTPrintSettings(model)
      settings.setWorkPath(workPath)

      // PT defaults are generally safer without forced cuts for single QR labels.
      settings.autoCutForEachPageCount = 1
      settings.isAutoCut = false
      settings.isHalfCut = false
      settings.isChainPrint = false
      settings.isCutPause = false
      settings.isCutmarkPrint = false
      settings.isSpecialTapePrint = false
      settings.resolution = PrintImageSettings.Resolution.Normal
      settings.imageRotation = PrintImageSettings.Rotation.Rotate0
      settings.halftone = PrintImageSettings.Halftone.Threshold
      settings.halftoneThreshold = 128

      dictionary.forEach { (key, value) ->
        when (key) {
          "labelSize" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Label Size: $value")
              settings.labelSize = _ptLabelSizeFromValue(value.toInt())
            }
          }
          "autoCutForEachPageCount" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Auto Cut Page Count: $value")
              settings.autoCutForEachPageCount = value.toInt()
            }
          }
          "autoCut" -> {
            if (value is Boolean) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Auto Cut: $value")
              settings.isAutoCut = value
            }
          }
          "resolution" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Resolution: $value")
              settings.resolution = _resolutionFromValue(value.toInt())
            }
          }
          "imageRotation" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Rotation: $value")
              settings.imageRotation = _rotationFromValue(value.toInt())
            }
          }
          "halftone" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Halftone: $value")
              settings.halftone = _halftoneFromValue(value.toInt())
            }
          }
          "halftoneThreshold" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    PT Halftone Threshold: $value")
              settings.halftoneThreshold = value.toInt()
            }
          }
        }
      }

      return settings
    }

    fun settingsFromDictionary(dictionary: Map<String, Any>, modelName: String, workPath: String): PrintSettings {
      val normalizedModelName = modelName.trim().uppercase().replace(" ", "")

      // decode supported model from name
      var model = _printerModelFromName(modelName)
      if (model == null) {
        throw GenericError("Unsupported printer model: $modelName")
      }

      // construct default settings for the model
      if (normalizedModelName.startsWith("PT-")) {
        return _parseSettings_PTSeries(dictionary, model, workPath)
      }

      val settings = QLPrintSettings(model)
      settings.setWorkPath(workPath)

      // configure default settings
      settings.autoCutForEachPageCount  = 1
      settings.isAutoCut                = false
      settings.isCutAtEnd               = false
      settings.resolution               = PrintImageSettings.Resolution.Normal
      settings.imageRotation            = PrintImageSettings.Rotation.Rotate0
      settings.halftone                 = PrintImageSettings.Halftone.Threshold
      settings.halftoneThreshold        = 128

      // parse settings from dictionary
      dictionary.forEach { (key, value) ->
        when (key) {
          "labelSize" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    Label Size: $value")
              settings.labelSize = _labelSizeFromValue(value.toInt())
            }
          }
          "autoCutForEachPageCount" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    Auto Cut Page Count: $value")
              settings.autoCutForEachPageCount = value.toInt()
            }
          }
          "autoCut" -> {
            if (value is Boolean) {
              Log.d("ExpoBrotherPrinterSdk", "-    Auto Cut: $value")
              settings.isAutoCut = value
            }
          }
          "cutAtEnd" -> {
            if (value is Boolean) {
              Log.d("ExpoBrotherPrinterSdk", "-    Cut At End: $value")
              settings.isCutAtEnd = value
            }
          }
          "resolution" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    Resolution: $value")
              settings.resolution = _resolutionFromValue(value.toInt())
            }
          }
          "imageRotation" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    Rotation: $value")
              settings.imageRotation = _rotationFromValue(value.toInt())
            }
          }
          "halftone" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    Halftone: $value")
              settings.halftone = _halftoneFromValue(value.toInt())
            }
          }
          "halftoneThreshold" -> {
            if (value is Double) {
              Log.d("ExpoBrotherPrinterSdk", "-    Halftone Threshold: $value")
              settings.halftoneThreshold = value.toInt()
            }
          }
        }
      }

      return settings
    }
  }
}
