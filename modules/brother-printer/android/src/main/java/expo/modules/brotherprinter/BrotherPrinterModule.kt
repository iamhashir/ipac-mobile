package expo.modules.brotherprinter

import android.bluetooth.BluetoothAdapter
import android.net.Uri
import com.brother.sdk.lmprinter.Channel
import com.brother.sdk.lmprinter.GetStatusResult
import com.brother.sdk.lmprinter.OpenChannelError
import com.brother.sdk.lmprinter.PrintError
import com.brother.sdk.lmprinter.PrinterDriver
import com.brother.sdk.lmprinter.PrinterDriverGenerator
import com.brother.sdk.lmprinter.PrinterModel
import com.brother.sdk.lmprinter.PrinterSearchError
import com.brother.sdk.lmprinter.PrinterSearcher
import com.brother.sdk.lmprinter.PrinterStatus
import com.brother.sdk.lmprinter.setting.PTPrintSettings
import com.brother.sdk.lmprinter.setting.PrintImageSettings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.Locale

class BrotherPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BrotherPrinter")

    Events("onConnectionStateChange")

    AsyncFunction("searchBluetoothPrintersAsync") {
      searchBluetoothPrinters()
    }

    AsyncFunction("printLabelFileAsync") { address: String, filePath: String, modelName: String?, labelWidthMm: Int ->
      val normalizedPath = normalizeFilePath(filePath)
      val file = File(normalizedPath)
      if (!file.exists()) {
        throw Exception("BROTHER_FILE_NOT_FOUND: File does not exist at path: $normalizedPath")
      }

      withBluetoothDriver(address, modelName) { driver ->
        emitConnectionState("status_check", address = address, modelName = modelName)
        val preStatus = mapStatusResult(driver.getPrinterStatus())
        throwIfBlockingStatus(preStatus)

        emitConnectionState("printing", address = address, modelName = modelName)
        val settings = buildPtPrintSettings(modelName, labelWidthMm)
        val printError = if (normalizedPath.lowercase(Locale.US).endsWith(".pdf")) {
          driver.printPDF(normalizedPath, settings)
        } else {
          driver.printImage(normalizedPath, settings)
        }

        throwIfPrintError(printError)

        val postStatus = mapStatusResult(driver.getPrinterStatus())
        throwIfBlockingStatus(postStatus)
        emitConnectionState("printed", address = address, modelName = modelName)

        mapOf("status" to postStatus)
      }
    }

    AsyncFunction("getPrinterStatusAsync") { address: String, modelName: String? ->
      withBluetoothDriver(address, modelName) { driver ->
        val status = mapStatusResult(driver.getPrinterStatus())
        mapOf("status" to status)
      }
    }
  }

  private fun searchBluetoothPrinters(): List<Map<String, Any?>> {
    val reactContext = appContext.reactContext
      ?: throw Exception("BROTHER_CONTEXT_UNAVAILABLE: React context is not available.")

    emitConnectionState("searching")
    val searchResult = PrinterSearcher.startBluetoothSearch(reactContext)
    val channels = searchResult.channels ?: arrayListOf()
    val searchErrorCode = searchResult.error?.code

    if (searchErrorCode != null && searchErrorCode != PrinterSearchError.ErrorCode.NoError && channels.isEmpty()) {
      val code = "BROTHER_SEARCH_${searchErrorCode.name.uppercase(Locale.US)}"
      emitConnectionState(
        "error",
        errorCode = code,
        message = "Bluetooth search failed: ${searchErrorCode.name}"
      )
      throw Exception("$code: Bluetooth search failed with ${searchErrorCode.name}.")
    }

    val mapped = channels
      .map { channel -> mapChannel(channel) }
      .sortedBy { channel -> String(channel["modelName"] ?: "") }

    emitConnectionState(
      "discovered",
      message = "Discovered ${mapped.size} paired Brother printer(s)."
    )
    return mapped
  }

  private fun mapChannel(channel: Channel): Map<String, Any?> {
    val modelName = getExtraInfo(channel, Channel.ExtraInfoKey.ModelName)
      ?: "Brother Printer"
    val serialNumber = getExtraInfo(channel, Channel.ExtraInfoKey.SerialNumber)
    val alias = getExtraInfo(channel, Channel.ExtraInfoKey.BluetoothAlias)
    val macAddress = getExtraInfo(channel, Channel.ExtraInfoKey.MACAddress)

    val address = listOf(
      channel.channelInfo,
      macAddress,
      serialNumber,
      alias,
      modelName
    ).firstOrNull { !it.isNullOrBlank() }?.trim().orEmpty()

    val connectionType = when (channel.channelType) {
      Channel.ChannelType.Bluetooth,
      Channel.ChannelType.BluetoothLowEnergy -> "bluetooth"
      else -> "unknown"
    }

    return mapOf(
      "modelName" to modelName,
      "address" to address,
      "serialNumber" to serialNumber,
      "alias" to alias,
      "channelType" to channel.channelType.name,
      "connectionType" to connectionType
    )
  }

  private fun getExtraInfo(channel: Channel, key: Channel.ExtraInfoKey): String? {
    return try {
      channel.extraInfo?.get(key)
    } catch (_: Throwable) {
      null
    }
  }

  private fun mapStatusResult(result: GetStatusResult?): Map<String, Any?> {
    val status = result?.printerStatus
    val statusErrorCode = try {
      result?.error?.code?.name
    } catch (_: Throwable) {
      null
    }

    val printerError = status?.errorCode
    val outOfPaper = printerError == PrinterStatus.ErrorCode.NoPaper
    val coverOpen = printerError == PrinterStatus.ErrorCode.CoverOpen
    val batteryLow = printerError == PrinterStatus.ErrorCode.BatteryEmpty ||
      printerError == PrinterStatus.ErrorCode.BatteryTrouble

    val statusKey = when {
      outOfPaper -> "outOfPaper"
      coverOpen -> "coverOpen"
      batteryLow -> "batteryLow"
      else -> null
    }

    return mapOf(
      "model" to status?.model?.name,
      "errorCode" to printerError?.name,
      "batteryStatus" to status?.batteryStatus?.name,
      "statusQueryError" to statusErrorCode,
      "outOfPaper" to outOfPaper,
      "coverOpen" to coverOpen,
      "batteryLow" to batteryLow,
      "statusKey" to statusKey
    )
  }

  private fun throwIfBlockingStatus(status: Map<String, Any?>) {
    when (status["statusKey"]) {
      "outOfPaper" -> throw Exception("BROTHER_OUT_OF_PAPER: Printer is out of tape or paper.")
      "coverOpen" -> throw Exception("BROTHER_COVER_OPEN: Printer cover is open.")
      "batteryLow" -> throw Exception("BROTHER_BATTERY_LOW: Printer battery is too low to print.")
    }
  }

  private fun throwIfPrintError(printError: PrintError?) {
    val code = printError?.code ?: return
    if (code == PrintError.ErrorCode.NoError) return

    val message = printError.errorDescription?.takeIf { it.isNotBlank() }
      ?: "Brother print failed with ${code.name}."

    when (code) {
      PrintError.ErrorCode.PrinterStatusErrorPaperEmpty -> {
        throw Exception("BROTHER_OUT_OF_PAPER: $message")
      }

      PrintError.ErrorCode.PrinterStatusErrorCoverOpen -> {
        throw Exception("BROTHER_COVER_OPEN: $message")
      }

      PrintError.ErrorCode.PrinterStatusErrorBatteryWeak -> {
        throw Exception("BROTHER_BATTERY_LOW: $message")
      }

      PrintError.ErrorCode.ChannelTimeout -> {
        throw Exception("BROTHER_CHANNEL_TIMEOUT: $message")
      }

      PrintError.ErrorCode.PrinterModelError -> {
        throw Exception("BROTHER_PRINTER_MODEL_ERROR: $message")
      }

      else -> {
        throw Exception("BROTHER_PRINT_FAILED: $message")
      }
    }
  }

  private fun <T> withBluetoothDriver(
    address: String,
    modelName: String?,
    operation: (PrinterDriver) -> T
  ): T {
    val trimmedAddress = address.trim()
    if (trimmedAddress.isEmpty()) {
      throw Exception("BROTHER_INVALID_ADDRESS: Printer address is required.")
    }

    val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
      ?: throw Exception("BROTHER_BLUETOOTH_UNAVAILABLE: Bluetooth adapter is unavailable.")

    emitConnectionState("connecting", address = trimmedAddress, modelName = modelName)
    val channel = Channel.newBluetoothChannel(trimmedAddress, bluetoothAdapter)
    val openResult = PrinterDriverGenerator.openChannel(channel)
    val openError = openResult.error
    val driver = openResult.driver

    if (openError == null || openError.code != OpenChannelError.ErrorCode.NoError || driver == null) {
      val code = openError?.code
      val mappedCode = when (code) {
        OpenChannelError.ErrorCode.OpenStreamFailure -> "BROTHER_OPEN_STREAM_FAILURE"
        OpenChannelError.ErrorCode.Timeout -> "BROTHER_OPEN_TIMEOUT"
        else -> "BROTHER_OPEN_CHANNEL_FAILED"
      }
      emitConnectionState(
        "error",
        address = trimmedAddress,
        modelName = modelName,
        errorCode = mappedCode,
        message = "Failed to open Bluetooth channel (${code?.name ?: "Unknown"})."
      )
      throw Exception("$mappedCode: Failed to open Bluetooth channel (${code?.name ?: "Unknown"}).")
    }

    emitConnectionState("connected", address = trimmedAddress, modelName = modelName)

    try {
      return operation(driver)
    } catch (error: Exception) {
      emitConnectionState(
        "error",
        address = trimmedAddress,
        modelName = modelName,
        errorCode = extractTaggedErrorCode(error.message),
        message = error.message ?: "Unknown Brother print error"
      )
      throw error
    } finally {
      try {
        driver.closeChannel()
      } catch (_: Throwable) {
      }
      emitConnectionState("disconnected", address = trimmedAddress, modelName = modelName)
    }
  }

  private fun extractTaggedErrorCode(message: String?): String? {
    val raw = message?.trim().orEmpty()
    val separatorIndex = raw.indexOf(':')
    val code = if (separatorIndex > 0) raw.substring(0, separatorIndex) else raw
    return if (code.startsWith("BROTHER_")) code else null
  }

  private fun buildPtPrintSettings(modelName: String?, labelWidthMm: Int): PTPrintSettings {
    val printerModel = resolvePrinterModel(modelName)
    val settings = PTPrintSettings(printerModel)

    settings.setLabelSize(resolveLabelSize(labelWidthMm))
    settings.setAutoCut(true)
    settings.setHalfCut(true)
    settings.setAutoCutForEachPageCount(1)
    settings.setChainPrint(false)
    settings.setSpecialTapePrint(false)

    // Keep output at the highest available quality for PT labels.
    settings.setResolution(PrintImageSettings.Resolution.High)
    settings.setPrintQuality(PrintImageSettings.PrintQuality.Best)
    settings.setNumCopies(1)
    settings.setSkipStatusCheck(false)
    settings.setForceVanishingMargin(true)
    settings.setFeedDirectionMargins(0)

    val workPath = appContext.reactContext?.cacheDir?.absolutePath.orEmpty()
    settings.setWorkPath(workPath)

    return settings
  }

  private fun resolveLabelSize(widthMm: Int): PTPrintSettings.LabelSize {
    return when {
      widthMm <= 12 -> PTPrintSettings.LabelSize.Width12mm
      widthMm <= 18 -> PTPrintSettings.LabelSize.Width18mm
      widthMm <= 24 -> PTPrintSettings.LabelSize.Width24mm
      else -> PTPrintSettings.LabelSize.Width36mm
    }
  }

  private fun resolvePrinterModel(modelHint: String?): PrinterModel {
    val candidates = printerModelCandidates(modelHint)
    for (candidate in candidates) {
      try {
        return PrinterModel.valueOf(candidate)
      } catch (_: IllegalArgumentException) {
      }
    }

    return PrinterModel.values().firstOrNull { value -> value.name.startsWith("PT_") }
      ?: PrinterModel.values().first()
  }

  private fun printerModelCandidates(modelHint: String?): List<String> {
    val normalized = normalizeModelHint(modelHint)
    val candidates = mutableListOf<String>()

    if (normalized.isNotBlank()) {
      candidates.add(normalized)

      if (normalized.startsWith("PT_E920BT")) {
        candidates.add("PT_E920BT")
      }
      if (normalized.startsWith("PT_E560BT")) {
        candidates.add("PT_E560BT")
      }
      if (normalized.startsWith("PT_E550W")) {
        candidates.add("PT_E550W")
      }

      val withoutTrailingDigits = normalized.replace(Regex("(BT|W)\\d+$"), "$1")
      if (withoutTrailingDigits.isNotBlank()) {
        candidates.add(withoutTrailingDigits)
      }
    }

    candidates.addAll(
      listOf(
        "PT_E920BT",
        "PT_E560BT",
        "PT_E550W"
      )
    )

    return candidates.distinct()
  }

  private fun normalizeModelHint(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return value
      .trim()
      .uppercase(Locale.US)
      .replace("-", "_")
      .replace(" ", "")
  }

  private fun normalizeFilePath(input: String): String {
    val trimmed = input.trim()
    if (trimmed.startsWith("file://", ignoreCase = true)) {
      val parsed = Uri.parse(trimmed)
      parsed.path?.let { path ->
        if (path.isNotBlank()) return path
      }
      return trimmed.removePrefix("file://")
    }
    return trimmed
  }

  private fun emitConnectionState(
    state: String,
    address: String? = null,
    modelName: String? = null,
    errorCode: String? = null,
    message: String? = null
  ) {
    val payload = mutableMapOf<String, Any?>(
      "state" to state,
      "timestampMs" to System.currentTimeMillis()
    )

    if (!address.isNullOrBlank()) payload["address"] = address
    if (!modelName.isNullOrBlank()) payload["modelName"] = modelName
    if (!errorCode.isNullOrBlank()) payload["errorCode"] = errorCode
    if (!message.isNullOrBlank()) payload["message"] = message

    sendEvent("onConnectionStateChange", payload)
  }
}
