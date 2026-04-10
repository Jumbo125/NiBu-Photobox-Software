from __future__ import annotations

import os
import sys
from dataclasses import asdict, is_dataclass
from typing import Any

from common_dnp import (
    DnpModelResolver,
    DnpProtocolClient,
    FreeBufferInfo,
    MediaTypeInfo,
    PrinterDetectionResult,
    PrinterProbeResult,
    PrinterStatusInfo,
    RemainingPrintsInfo,
    SimulationTransport,
    format_status,
    resolve_printer_model_from_windows_device_path,
)
from linux_dnp import LinuxPrinterDetector, LinuxUsbPrinterTransport
from windows_dnp import WindowsPrinterDetector, WindowsUsbPrinterTransport, WindowsUsbVidPidCatalog, try_find_usb_identity


KNOWN_COMMANDS = ["detect", "ports", "info", "probe", "status", "remaining", "media", "free-buffer"]
OPTIONS_WITH_VALUES = [
    "--model",
    "-m",
    "--transport",
    "--printer",
    "--device",
    "--device-index",
    "--port",
    "--dll-path",
    "--start-port",
    "--end-port",
    "--read-timeout-ms",
    "--post-write-delay-ms",
]


class CliOptions:
    def __init__(
        self,
        command: str | None,
        model: str | None,
        json_output: bool,
        simulate: bool,
        show_help: bool,
        transport: str,
        printer: str | None,
        device: str | None,
        port: int | None,
        dll_path: str | None,
        start_port: int,
        end_port: int,
        read_timeout_ms: int,
        post_write_delay_ms: int,
    ) -> None:
        self.command = command
        self.model = model
        self.json = json_output
        self.simulate = simulate
        self.show_help = show_help
        self.transport = transport
        self.printer = printer
        self.device = device
        self.port = port
        self.dll_path = dll_path
        self.start_port = start_port
        self.end_port = end_port
        self.read_timeout_ms = read_timeout_ms
        self.post_write_delay_ms = post_write_delay_ms

    @staticmethod
    def parse(args: list[str]) -> "CliOptions":
        if not args:
            return CliOptions(None, None, False, False, True, "auto", None, None, None, None, 0, 7, 5000, 75)

        normalized_args = [x for x in args if x != "-"]
        json_output = any(x.lower() == "--json" for x in normalized_args)
        simulate = any(x.lower() == "--simulate" for x in normalized_args)
        show_help = any(x in ("-h", "--help", "/?") for x in normalized_args)
        command = CliOptions._get_command(normalized_args)
        model = DnpModelResolver.normalize(
            CliOptions._get_option(normalized_args, "--model")
            or CliOptions._get_option(normalized_args, "-m")
            or CliOptions._get_positional_model_hint(normalized_args)
        )
        return CliOptions(
            command,
            model,
            json_output,
            simulate,
            show_help,
            CliOptions._get_option(normalized_args, "--transport") or "auto",
            CliOptions._get_option(normalized_args, "--printer") or _get_env("DNP_PRINTER_NAME"),
            CliOptions._get_option(normalized_args, "--device") or _get_env("DNP_PRINTER_DEVICE"),
            CliOptions._get_nullable_int_option(normalized_args, "--device-index")
            or CliOptions._get_nullable_int_option(normalized_args, "--port")
            or _get_nullable_int(_get_env("DNP_PRINTER_DEVICE_INDEX"))
            or _get_nullable_int(_get_env("DNP_PRINTER_PORT")),
            CliOptions._get_option(normalized_args, "--dll-path") or _get_env("DNP_CSPSTAT_PATH"),
            CliOptions._get_int_option(normalized_args, "--start-port", 0),
            CliOptions._get_int_option(normalized_args, "--end-port", 7),
            CliOptions._get_int_option(normalized_args, "--read-timeout-ms", 5000),
            CliOptions._get_int_option(normalized_args, "--post-write-delay-ms", 75),
        )

    @staticmethod
    def _get_command(args: list[str]) -> str | None:
        for arg in args:
            normalized = CliOptions._try_normalize_command(arg)
            if normalized:
                return normalized
        return None

    @staticmethod
    def _get_positional_model_hint(args: list[str]) -> str | None:
        i = 0
        while i < len(args):
            arg = args[i]
            if CliOptions._try_normalize_command(arg):
                i += 1
                continue
            if arg.lower() in ("--json", "--simulate") or arg in ("-h", "--help", "/?"):
                i += 1
                continue
            if any(arg.lower() == opt.lower() for opt in OPTIONS_WITH_VALUES):
                i += 2
                continue
            if arg.startswith("-"):
                i += 1
                continue
            return arg
        return None

    @staticmethod
    def _get_option(args: list[str], name: str) -> str | None:
        for i, arg in enumerate(args):
            if arg.lower() == name.lower():
                return args[i + 1] if i + 1 < len(args) else None
            prefix = name + "="
            if arg.lower().startswith(prefix.lower()):
                return arg[len(prefix):]
        return None

    @staticmethod
    def _get_int_option(args: list[str], name: str, default_value: int) -> int:
        return CliOptions._get_nullable_int_option(args, name) or default_value

    @staticmethod
    def _get_nullable_int_option(args: list[str], name: str) -> int | None:
        return _get_nullable_int(CliOptions._get_option(args, name))

    @staticmethod
    def _try_normalize_command(arg: str) -> str | None:
        for candidate in KNOWN_COMMANDS:
            if candidate.lower() == arg.lower():
                return candidate
        return None


def _get_env(name: str) -> str | None:
    value = os.environ.get(name)
    return value if value not in (None, "") else None


def _get_nullable_int(text: str | None) -> int | None:
    if text is None:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _is_windows() -> bool:
    return os.name == "nt"


def _is_linux() -> bool:
    return os.name == "posix" and hasattr(os, "uname") and os.uname().sysname.lower() == "linux"


def detect_printer(options: CliOptions) -> PrinterDetectionResult:
    if options.simulate:
        simulated_transport = ("windows" if _is_windows() else "linux") if options.transport == "auto" else options.transport
        if simulated_transport.lower() == "linux":
            return PrinterDetectionResult(
                True,
                True,
                "linux",
                "--device",
                options.device or "usb:vid=1343,pid=000c,serial=SIM-LINUX-0001",
                None,
                "DNP DS620",
                "/dev/usb/lp0",
                options.model or "DS620",
                "DNP DS620",
                "DNP",
                None,
                "1343",
                "000c",
                "SIM-LINUX-0001",
                1,
                1,
                "Simulation mode.",
                None,
                None,
            )
        return PrinterDetectionResult(
            True,
            True,
            "windows",
            "--device",
            options.device or r"\\?\usb#vid_1452&pid_9201#SIM-WIN-0001#{a5dcbf10-6530-11d2-901f-00c04fb951ed}",
            None,
            options.printer or "DNP QW410",
            options.device or r"\\?\usb#vid_1452&pid_9201#SIM-WIN-0001#{a5dcbf10-6530-11d2-901f-00c04fb951ed}",
            options.model or "QW410",
            "DNP QW410",
            "DNP",
            None,
            "1452",
            "9201",
            "SIM-WIN-0001",
            None,
            None,
            "Simulation mode.",
            r"USB\VID_1452&PID_9201\SIM-WIN-0001",
            r"USBPRINT\DNPQW410\SIM-WIN-0001",
        )

    if options.transport == "windows":
        return WindowsPrinterDetector.detect(options.printer, options.model, options.port, options.dll_path, options.start_port, options.end_port)
    if options.transport == "linux":
        return LinuxPrinterDetector.detect(options.device, options.model)
    if _is_windows():
        return WindowsPrinterDetector.detect(options.printer, options.model, options.port, options.dll_path, options.start_port, options.end_port)
    if _is_linux():
        return LinuxPrinterDetector.detect(options.device, options.model)
    raise RuntimeError("Only Windows and Linux are currently supported.")


def _resolve_detected_model(detection: PrinterDetectionResult | None) -> str | None:
    if detection is None:
        return None
    return getattr(detection, "model", None) or WindowsUsbVidPidCatalog.try_get_model(
        getattr(detection, "vendor_id", None),
        getattr(detection, "product_id", None),
    )


def create_transport(options: CliOptions):
    if options.transport == "windows":
        return WindowsUsbPrinterTransport(
            printer_name=options.printer,
            selection_hint=options.model,
            device_path=options.device,
            read_timeout_ms=options.read_timeout_ms,
            post_write_delay_ms=options.post_write_delay_ms,
        )
    if options.transport == "linux":
        return LinuxUsbPrinterTransport(
            device_path=options.device,
            read_timeout_ms=options.read_timeout_ms,
            post_write_delay_ms=options.post_write_delay_ms,
        )
    if _is_windows():
        return WindowsUsbPrinterTransport(
            printer_name=options.printer,
            selection_hint=options.model,
            device_path=options.device,
            read_timeout_ms=options.read_timeout_ms,
            post_write_delay_ms=options.post_write_delay_ms,
        )
    if _is_linux():
        return LinuxUsbPrinterTransport(
            device_path=options.device,
            read_timeout_ms=options.read_timeout_ms,
            post_write_delay_ms=options.post_write_delay_ms,
        )
    raise RuntimeError("Only Windows and Linux are currently supported.")


def write_detect(json_output: bool, detection: PrinterDetectionResult) -> int:
    success = detection.success and bool(detection.query_value and detection.query_value.strip())
    if json_output:
        if success:
            payload: dict[str, Any] = {
                "message": "succes",
                "VID": detection.vendor_id,
                "PID": detection.product_id,
                "Printermodel": detection.model or WindowsUsbVidPidCatalog.try_get_model(detection.vendor_id, detection.product_id),
                "device_id": detection.query_value,
            }
        else:
            payload = {"message": "fail", "error": "kein drucker gefunden"}
        print(_json_dumps(payload))
        return 0 if success else 1

    print(f"message: {'succes' if success else 'fail'}")
    if not success:
        print("kein drucker gefunden")
        return 1
    print(f"VID: {detection.vendor_id or 'n/a'}")
    print(f"PID: {detection.product_id or 'n/a'}")
    print(f"Printermodel: {detection.model or WindowsUsbVidPidCatalog.try_get_model(detection.vendor_id, detection.product_id) or 'n/a'}")
    print(f"device_id: {detection.query_value}")
    return 0


def write_info(
    json_output: bool,
    probe: PrinterProbeResult,
    printer_model: str | None,
    printer_model_raw: str | None = None,
) -> int:
    remaining_value: Any = (
        probe.remaining_prints.count
        if probe.remaining_prints.count is not None
        else probe.remaining_prints.raw_value
    )
    free_buffer_value: Any = (
        probe.free_buffer.count
        if probe.free_buffer.count is not None
        else probe.free_buffer.raw_value
    )
    status_text = format_status(probe.status)
    media_text = probe.media_type.name if probe.media_type.name.strip() else probe.media_type.raw_value

    if json_output:
        payload = {
            "message": "succes",
            "Printermodel": printer_model or "unknown",
            "Printermodel_raw": printer_model_raw,
            "status": status_text,
            "status_raw": probe.status.raw_code,
            "Remaining prints": remaining_value,
            "Remaining prints_raw": probe.remaining_prints.raw_value,
            "Media": media_text,
            "Media_raw": probe.media_type.raw_value,
            "Free buffer": free_buffer_value,
            "Free buffer_raw": probe.free_buffer.raw_value,
        }
        print(_json_dumps(payload))
        return 0

    print("message: succes")
    print(f"Printermodel: {printer_model or 'unknown'}")
    print(f"Printermodel_raw: {printer_model_raw or 'n/a'}")
    print(f"status: {status_text}")
    print(f"status_raw: {probe.status.raw_code}")
    print(f"Remaining prints: {remaining_value}")
    print(f"Remaining prints_raw: {probe.remaining_prints.raw_value}")
    print(f"Media: {media_text}")
    print(f"Media_raw: {probe.media_type.raw_value}")
    print(f"Free buffer: {free_buffer_value}")
    print(f"Free buffer_raw: {probe.free_buffer.raw_value}")
    return 0


def resolve_printer_model(options: CliOptions) -> str | None:
    from_hint = DnpModelResolver.try_detect_from_text(options.model, options.printer, options.device)
    if from_hint:
        return from_hint
    if _is_windows():
        from_device_path = resolve_printer_model_from_windows_device_path(options.device, WindowsUsbVidPidCatalog.try_get_model)
        if from_device_path:
            return from_device_path
        identity = try_find_usb_identity(options.printer, options.model)
        from_identity = DnpModelResolver.try_detect_from_text(
            identity.friendly_name if identity else None,
            identity.device_description if identity else None,
            identity.printer_name if identity else None,
            WindowsUsbVidPidCatalog.try_get_model(identity.vendor_id if identity else None, identity.product_id if identity else None),
        )
        if from_identity:
            return from_identity
    return None


def write_value(json_output: bool, value: Any) -> int:
    if json_output:
        print(_json_dumps(_json_ready(value)))
        return 0

    if isinstance(value, PrinterStatusInfo):
        print(f"Status: {value.description} ({value.raw_code})")
    elif isinstance(value, RemainingPrintsInfo):
        print(f"Remaining prints: {value.count if value.count is not None else 'n/a'} [{value.raw_value}]")
    elif isinstance(value, MediaTypeInfo):
        print(f"Media: {value.name} [{value.raw_value}]")
    elif isinstance(value, FreeBufferInfo):
        print(f"Free buffer: {value.count if value.count is not None else 'n/a'} [{value.raw_value}]")
    else:
        print(value)
    return 0


def unknown_command(command: str) -> int:
    print(f"Unknown command: {command}", file=sys.stderr)
    print_help()
    return 1


def print_help() -> None:
    print("main_dnp.py <command> [model-hint] [options]")
    print()
    print("Commands:")
    print("  detect       Detects a USB printer and prints VID, PID, printer model and device_id.")
    print("               Windows returns the raw USB device path as device_id.")
    print("  ports        Not available in DLL-free Windows raw USB mode.")
    print("  info         Reads printer model, status, remaining prints, media and free buffer.")
    print("  status       Reads only printer status.")
    print("  remaining    Reads only remaining prints.")
    print("  media        Reads only media type.")
    print("  free-buffer  Reads only free buffer.")
    print()
    print("Examples:")
    print("  python main_dnp.py detect")
    print("  python main_dnp.py detect --json")
    print(r"  python main_dnp.py status --device \\?\usb#vid_1452&pid_9201#...")
    print(r"  python main_dnp.py info --device \\?\usb#vid_1452&pid_9201#... --json")
    print('  python main_dnp.py info QW410 --printer "DP-QW410"')
    print("  python main_dnp.py ports --start-port 0 --end-port 31 --json")
    print()
    print("Detect output:")
    print("  Plain text: message, VID, PID, Printermodel, device_id.")
    print("  JSON: message, VID, PID, Printermodel, device_id.")
    print()
    print("Options:")
    print("  --json")
    print("  --simulate")
    print("  --transport auto|windows|linux")
    print("  --model <text>               Optional free-form model hint.")
    print('  --printer "DP-QW410"       Windows printer name. Also via DNP_PRINTER_NAME.')
    print("  --device /dev/usb/lp0        Linux device path or USB selector. Also via DNP_PRINTER_DEVICE.")
    print(r"  --device \\?\usb#...      Windows raw USB device path. Also via DNP_PRINTER_DEVICE.")
    print("  --device-index / --port      Legacy option, ignored in DLL-free Windows raw USB mode.")
    print("  --dll-path                   Legacy option, ignored in DLL-free Windows raw USB mode.")
    print("  --start-port / --end-port    Legacy option, ignored in DLL-free Windows raw USB mode.")
    print("  --read-timeout-ms 5000")
    print("  --post-write-delay-ms 75")


def _json_ready(value: Any) -> Any:
    if isinstance(value, PrinterStatusInfo):
        return {"rawCode": value.raw_code, "status": value.status.name, "description": value.description}
    if isinstance(value, RemainingPrintsInfo):
        return {"rawValue": value.raw_value, "count": value.count}
    if isinstance(value, MediaTypeInfo):
        return {"rawValue": value.raw_value, "name": value.name}
    if isinstance(value, FreeBufferInfo):
        return {"rawValue": value.raw_value, "count": value.count}
    if isinstance(value, PrinterProbeResult):
        return {
            "status": _json_ready(value.status),
            "remainingPrints": _json_ready(value.remaining_prints),
            "mediaType": _json_ready(value.media_type),
            "freeBuffer": _json_ready(value.free_buffer),
        }
    if is_dataclass(value):
        return _camelize(asdict(value))
    return value


def _camelize(value: Any) -> Any:
    if isinstance(value, dict):
        return {_to_camel(k): _camelize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_camelize(v) for v in value]
    return value


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def _json_dumps(value: Any) -> str:
    import json
    return json.dumps(value, indent=2, ensure_ascii=False)


def run(argv: list[str]) -> int:
    options = CliOptions.parse(argv)
    if options.show_help or not options.command:
        print_help()
        return 0
    try:
        if options.command.lower() == "detect":
            detection = detect_printer(options)
            return write_detect(options.json, detection)
        if options.command.lower() == "ports":
            if not _is_windows():
                print("The ports command is only available on Windows.", file=sys.stderr)
                return 2
            raise NotImplementedError("The ports command is not available in the DLL-free Windows raw USB mode.")

        transport = SimulationTransport() if options.simulate else create_transport(options)
        client = DnpProtocolClient(transport)

        if options.command in ("info", "probe"):
            probe = client.probe()
            detection = detect_printer(options)
            detected_model = _resolve_detected_model(detection)
            resolved_model = resolve_printer_model(options) or detected_model
            return write_info(options.json, probe, resolved_model, detected_model)
        
        if options.command == "status":
            return write_value(options.json, client.get_printer_status())
        if options.command == "remaining":
            return write_value(options.json, client.get_remaining_prints())
        if options.command == "media":
            return write_value(options.json, client.get_media_type())
        if options.command == "free-buffer":
            return write_value(options.json, client.get_free_buffer())
        return unknown_command(options.command)
    except (OSError, IOError, RuntimeError, TimeoutError, NotImplementedError) as ex:
        print(str(ex), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
