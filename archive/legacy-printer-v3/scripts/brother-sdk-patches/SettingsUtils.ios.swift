//
//  SettingsUtils.swift
//  Pods
//
//  Created by Rakesh Ayyaswami on 23/9/2024.
//

import BRLMPrinterKit


internal class SettingsUtils {

    private static func _normalizeModelName(_ name: String) -> String {
        return name.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: " ", with: "")
    }

    private static func _resolvePTModel(_ normalizedName: String) -> BRLMPrinterModel? {
        // Compatibility alias: this bundled BRLM SDK does not expose PT_E920BT directly.
        if normalizedName.hasPrefix("PT-E920BT") { return .PT_E560BT }
        if normalizedName.hasPrefix("PT-E560BT") { return .PT_E560BT }
        if normalizedName.hasPrefix("PT-E510") { return .PT_E510 }
        if normalizedName.hasPrefix("PT-E310BT") { return .PT_E310BT }
        if normalizedName.hasPrefix("PT-E550W") { return .PT_E550W }
        if normalizedName.hasPrefix("PT-P710BT") { return .PT_P710BT }
        if normalizedName.hasPrefix("PT-P715EBT") { return .PT_P715eBT }
        if normalizedName.hasPrefix("PT-P910BT") { return .PT_P910BT }
        if normalizedName.hasPrefix("PT-P300BT") { return .PT_P300BT }
        if normalizedName.hasPrefix("PT-D410") { return .PT_D410 }
        if normalizedName.hasPrefix("PT-D460BT") { return .PT_D460BT }
        if normalizedName.hasPrefix("PT-D610BT") { return .PT_D610BT }

        return nil
    }

    private static func _ptLabelSizeFromValue(_ value: Int) -> BRLMPTPrintSettingsLabelSize {
        switch value {
        case 0:
            return .width3_5mm
        case 1:
            return .width6mm
        case 2:
            return .width9mm
        case 3, 17:
            return .width12mm
        case 4, 18:
            return .width18mm
        case 5, 19:
            return .width24mm
        case 6, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29:
            return .width36mm
        case 7:
            return .widthHS_5_8mm
        case 8:
            return .widthHS_8_8mm
        case 9:
            return .widthHS_11_7mm
        case 10:
            return .widthHS_17_7mm
        case 11:
            return .widthHS_23_6mm
        case 12:
            return .widthFL_21x45mm
        case 13:
            return .widthHS_5_2mm
        case 14:
            return .widthHS_9_0mm
        case 15:
            return .widthHS_11_2mm
        case 16:
            return .widthHS_21_0mm
        default:
            return .width12mm
        }
    }
    
    private static func _printerModelFromName(_ name: String) throws -> BRLMPrinterModel {
        let normalizedName = _normalizeModelName(name)

        switch normalizedName {
        case "QL-710W":    return .QL_710W
        case "QL-720NW":   return .QL_720NW
        case "QL-810W":    return .QL_810W
        case "QL-820NWB":  return .QL_820NWB
        case "QL-1110NWB": return .QL_1110NWB
        case "QL-1115NWB": return .QL_1115NWB

        default:
            if let ptModel = _resolvePTModel(normalizedName) {
                return ptModel
            }
            throw GenericError(description: "Unsupported printer model")
        }
    }
    
    private static func _parseSettings_QLSeries(_ reader: DictionaryReadWrite, model: BRLMPrinterModel) throws -> BRLMQLPrintSettings {
        guard let settings = BRLMQLPrintSettings(defaultPrintSettingsWith: model) else {
            throw GenericError(description: "Failed to initialize printer settings object")
        }
        
        settings.labelSize               = reader.read("labelSize",               nvl: settings.labelSize) { BRLMQLPrintSettingsLabelSize(rawValue: $0) }
        settings.autoCutForEachPageCount = reader.read("autoCutForEachPageCount", nvl: 1)
        settings.autoCut                 = reader.read("autoCut",                 nvl: false)
        settings.cutAtEnd                = reader.read("cutAtEnd",                nvl: false)
        settings.resolution              = reader.read("resolution",              nvl: .normal)            { BRLMPrintSettingsResolution(rawValue: $0) }
        settings.imageRotation           = reader.read("imageRotation",           nvl: .rotate0)           { BRLMPrintSettingsRotation(rawValue: $0) }
        settings.halftone                = reader.read("halftone",                nvl: .threshold)         { BRLMPrintSettingsHalftone(rawValue: $0) }
        settings.halftoneThreshold       = reader.read("halftoneThreshold",       nvl: 128)
        
        return settings
    }

    private static func _parseSettings_PTSeries(_ reader: DictionaryReadWrite, model: BRLMPrinterModel) throws -> BRLMPTPrintSettings {
        guard let settings = BRLMPTPrintSettings(defaultPrintSettingsWithPrinterModel: model) else {
            throw GenericError(description: "Failed to initialize printer settings object")
        }

        settings.labelSize               = reader.read("labelSize",               nvl: settings.labelSize) { _ptLabelSizeFromValue($0) }
        settings.autoCutForEachPageCount = reader.read("autoCutForEachPageCount", nvl: 1)
        settings.autoCut                 = reader.read("autoCut",                 nvl: false)
        settings.resolution              = reader.read("resolution",              nvl: .normal)            { BRLMPrintSettingsResolution(rawValue: $0) }
        settings.imageRotation           = reader.read("imageRotation",           nvl: .rotate0)           { BRLMPrintSettingsRotation(rawValue: $0) }
        settings.halftone                = reader.read("halftone",                nvl: .threshold)         { BRLMPrintSettingsHalftone(rawValue: $0) }
        settings.halftoneThreshold       = reader.read("halftoneThreshold",       nvl: 128)

        return settings
    }
    
    internal static func settingsFromDictionary(_ settings: [String: Any], modelName: String) throws  -> BRLMPrintSettingsProtocol {

        let normalizedModelName = _normalizeModelName(modelName)

        // decode supported model from name
        let model  = try _printerModelFromName(modelName)

        // parse settings based on model
        let reader = DictionaryReadWrite(settings)
        if normalizedModelName.hasPrefix("QL") {
            return try _parseSettings_QLSeries(reader, model: model)
        }
        if normalizedModelName.hasPrefix("PT") {
            return try _parseSettings_PTSeries(reader, model: model)
        }
        
        // unknown model
        throw GenericError(description: "Unsupported printer model")
    }
}
