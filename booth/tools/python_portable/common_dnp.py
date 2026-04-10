from __future__ import annotations

import enum
import io
import json
import os
import re
from dataclasses import asdict, dataclass
from typing import Any, Optional, Protocol


class IDnpTransport(Protocol):
    def query(self, command: "DnpCommand") -> bytes: ...


@dataclass(frozen=True)
class DnpCommand:
    arg1: str
    arg2: str
    payload: bytes | None = None

    def encode(self) -> bytes:
        return DnpPacketCodec.encode(self)

    def __str__(self) -> str:
        return f"{self.arg1}/{self.arg2}"


class DnpCommands:
    STATUS = DnpCommand("STATUS", "")
    REMAINING_PRINTS = DnpCommand("INFO", "MQTY")
    MEDIA = DnpCommand("INFO", "MEDIA")
    FREE_BUFFER = DnpCommand("INFO", "FREE_PBUFFER")
    SERIAL_NUMBER = DnpCommand("INFO", "SERIAL_NUMBER")


class DnpPacketCodec:
    ESC = 0x1B
    COMMAND_MARKER = 0x50  # 'P'

    @staticmethod
    def encode(command: DnpCommand) -> bytes:
        payload = command.payload or b""
        arg1 = DnpPacketCodec._pad_ascii(command.arg1, 6)
        arg2 = DnpPacketCodec._pad_ascii(command.arg2, 16)
        length = f"{len(payload):08d}".encode("ascii")
        return bytes([DnpPacketCodec.ESC, DnpPacketCodec.COMMAND_MARKER]) + arg1 + arg2 + length + payload

    @staticmethod
    def decode_ascii_payload(response_bytes: bytes) -> str:
        expected_length = DnpPacketCodec.try_get_expected_response_length(response_bytes)
        if expected_length is not None and len(response_bytes) >= expected_length:
            payload_length_text = response_bytes[:8].decode("ascii", errors="ignore")
            try:
                payload_length = int(payload_length_text)
            except ValueError:
                payload_length = -1
            if payload_length >= 0 and len(response_bytes) >= 8 + payload_length:
                return response_bytes[8:8 + payload_length].decode("ascii", errors="ignore").rstrip("\0\r\n")
        return response_bytes.decode("ascii", errors="ignore").rstrip("\0\r\n")

    @staticmethod
    def try_get_expected_response_length(response_bytes: bytes | memoryview) -> int | None:
        if len(response_bytes) >= 8:
            first = bytes(response_bytes[:8])
            if all(48 <= b <= 57 for b in first):
                try:
                    payload_length = int(first.decode("ascii"))
                except ValueError:
                    return None
                return 8 + payload_length
        return None

    @staticmethod
    def _pad_ascii(value: str | None, size: int) -> bytes:
        padded = (value or "").ljust(size, " ")[:size]
        return padded.encode("ascii")


class PrinterStatusKind(enum.Enum):
    UNKNOWN = 0
    IDLE = 1
    PRINTING = 2
    COOLING = 3
    COVER_OPEN = 4
    PAPER_END = 5
    RIBBON_END = 6
    PAPER_JAM = 7
    RIBBON_ERROR = 8
    PAPER_DEFINITION_ERROR = 9
    DATA_ERROR = 10
    RFID_MODULE_ERROR = 11
    SYSTEM_ERROR = 12
    HARDWARE_ERROR = 13
    UNIT_ERROR = 14
    FLASH_PROGRAMMING = 15


@dataclass(frozen=True)
class PrinterStatusInfo:
    raw_code: str
    status: PrinterStatusKind
    description: str


@dataclass(frozen=True)
class RemainingPrintsInfo:
    raw_value: str
    count: int | None


@dataclass(frozen=True)
class MediaTypeInfo:
    raw_value: str
    name: str


@dataclass(frozen=True)
class FreeBufferInfo:
    raw_value: str
    count: int | None


@dataclass(frozen=True)
class PrinterProbeResult:
    status: PrinterStatusInfo
    remaining_prints: RemainingPrintsInfo
    media_type: MediaTypeInfo
    free_buffer: FreeBufferInfo


@dataclass(frozen=True)
class PrinterDetectionResult:
    success: bool
    query_ready: bool
    transport: str
    query_argument_name: str | None
    query_value: str | None
    port: int | None
    printer_name: str | None
    device_path: str | None
    model: str | None
    product_name: str | None
    manufacturer: str | None
    loaded_dll_path: str | None
    vendor_id: str | None
    product_id: str | None
    serial_number: str | None
    bus_number: int | None
    device_address: int | None
    match_reason: str | None
    usb_instance_id: str | None
    usb_print_instance_id: str | None


class DefaultMediaTypeMapper:
    def map(self, raw_value: str) -> MediaTypeInfo:
        normalized = raw_value.strip()
        if not normalized:
            return MediaTypeInfo(raw_value, "Unknown")
        return MediaTypeInfo(normalized, normalized.upper() if False else normalized)


class DnpParsers:
    _digit_run_regex = re.compile(r"\d+")
    _trailing_number_regex = re.compile(r"\d+$")

    @staticmethod
    def parse_status(response: str) -> PrinterStatusInfo:
        raw = response.strip()
        csp = DnpParsers._try_parse_csp_status(raw)
        if csp is not None:
            return csp

        code = DnpParsers._extract_first_digits(raw, 4) or raw
        mapping = {
            "0": PrinterStatusInfo(code, PrinterStatusKind.IDLE, "Idle"),
            "0000": PrinterStatusInfo(code, PrinterStatusKind.IDLE, "Idle"),
            "00000": PrinterStatusInfo(code, PrinterStatusKind.IDLE, "Idle"),
            "1": PrinterStatusInfo(code, PrinterStatusKind.PRINTING, "Printing"),
            "0001": PrinterStatusInfo(code, PrinterStatusKind.PRINTING, "Printing"),
            "00001": PrinterStatusInfo(code, PrinterStatusKind.PRINTING, "Printing"),
            "500": PrinterStatusInfo(code, PrinterStatusKind.COOLING, "Cooling"),
            "0500": PrinterStatusInfo(code, PrinterStatusKind.COOLING, "Cooling"),
            "00500": PrinterStatusInfo(code, PrinterStatusKind.COOLING, "Cooling"),
            "510": PrinterStatusInfo(code, PrinterStatusKind.COOLING, "Cooling"),
            "0510": PrinterStatusInfo(code, PrinterStatusKind.COOLING, "Cooling"),
            "00510": PrinterStatusInfo(code, PrinterStatusKind.COOLING, "Cooling"),
            "1000": PrinterStatusInfo(code, PrinterStatusKind.COVER_OPEN, "Cover open"),
            "01000": PrinterStatusInfo(code, PrinterStatusKind.COVER_OPEN, "Cover open"),
            "1100": PrinterStatusInfo(code, PrinterStatusKind.PAPER_END, "Paper end"),
            "01100": PrinterStatusInfo(code, PrinterStatusKind.PAPER_END, "Paper end"),
            "1200": PrinterStatusInfo(code, PrinterStatusKind.RIBBON_END, "Ribbon end"),
            "01200": PrinterStatusInfo(code, PrinterStatusKind.RIBBON_END, "Ribbon end"),
            "1300": PrinterStatusInfo(code, PrinterStatusKind.PAPER_JAM, "Paper jam"),
            "01300": PrinterStatusInfo(code, PrinterStatusKind.PAPER_JAM, "Paper jam"),
            "1400": PrinterStatusInfo(code, PrinterStatusKind.RIBBON_ERROR, "Ribbon error"),
            "01400": PrinterStatusInfo(code, PrinterStatusKind.RIBBON_ERROR, "Ribbon error"),
            "1500": PrinterStatusInfo(code, PrinterStatusKind.PAPER_DEFINITION_ERROR, "Paper definition error"),
            "01500": PrinterStatusInfo(code, PrinterStatusKind.PAPER_DEFINITION_ERROR, "Paper definition error"),
            "1600": PrinterStatusInfo(code, PrinterStatusKind.DATA_ERROR, "Data error"),
            "01600": PrinterStatusInfo(code, PrinterStatusKind.DATA_ERROR, "Data error"),
            "2800": PrinterStatusInfo(code, PrinterStatusKind.RFID_MODULE_ERROR, "RF-ID module error"),
            "02800": PrinterStatusInfo(code, PrinterStatusKind.RFID_MODULE_ERROR, "RF-ID module error"),
            "3000": PrinterStatusInfo(code, PrinterStatusKind.SYSTEM_ERROR, "System error"),
            "03000": PrinterStatusInfo(code, PrinterStatusKind.SYSTEM_ERROR, "System error"),
        }
        return mapping.get(code, PrinterStatusInfo(code, PrinterStatusKind.UNKNOWN, "Unknown"))

    @staticmethod
    def parse_remaining_prints(response: str) -> RemainingPrintsInfo:
        raw = response.strip()
        count = DnpParsers._parse_integer_after_prefix(raw, 4)
        return RemainingPrintsInfo(raw, count)

    @staticmethod
    def parse_media_type(response: str, mapper: DefaultMediaTypeMapper) -> MediaTypeInfo:
        return mapper.map(response.strip())

    @staticmethod
    def parse_free_buffer(response: str) -> FreeBufferInfo:
        raw = response.strip()
        if raw.upper().startswith("FBP"):
            count = DnpParsers._parse_integer_after_prefix(raw, 3)
        else:
            count = DnpParsers._extract_trailing_int(raw)
        return FreeBufferInfo(raw, count)

    @staticmethod
    def _try_parse_csp_status(raw: str) -> PrinterStatusInfo | None:
        normalized = raw.strip()
        if normalized.upper().startswith("CSP:"):
            normalized = normalized[4:]
        try:
            if normalized.lower().startswith("0x"):
                status = int(normalized[2:], 16)
            else:
                status = int(normalized)
        except ValueError:
            return None

        raw_code = f"0x{status:08X}"
        mapping = {
            0x00000000: PrinterStatusInfo(raw_code, PrinterStatusKind.IDLE, "Idle (compat)"),
            0x00010001: PrinterStatusInfo(raw_code, PrinterStatusKind.IDLE, "Idle"),
            0x00010002: PrinterStatusInfo(raw_code, PrinterStatusKind.PRINTING, "Printing"),
            0x00010020: PrinterStatusInfo(raw_code, PrinterStatusKind.IDLE, "Standstill"),
            0x00010040: PrinterStatusInfo(raw_code, PrinterStatusKind.COOLING, "Cooling"),
            0x00020001: PrinterStatusInfo(raw_code, PrinterStatusKind.COVER_OPEN, "Cover open"),
            0x00010008: PrinterStatusInfo(raw_code, PrinterStatusKind.PAPER_END, "Paper end"),
            0x00010010: PrinterStatusInfo(raw_code, PrinterStatusKind.RIBBON_END, "Ribbon end"),
            0x00020002: PrinterStatusInfo(raw_code, PrinterStatusKind.PAPER_JAM, "Paper jam"),
            0x00020004: PrinterStatusInfo(raw_code, PrinterStatusKind.RIBBON_ERROR, "Ribbon error"),
            0x00020008: PrinterStatusInfo(raw_code, PrinterStatusKind.PAPER_DEFINITION_ERROR, "Paper error"),
            0x00020010: PrinterStatusInfo(raw_code, PrinterStatusKind.DATA_ERROR, "Data error"),
            0x00020020: PrinterStatusInfo(raw_code, PrinterStatusKind.SYSTEM_ERROR, "Scrap box error"),
            0x00040000: PrinterStatusInfo(raw_code, PrinterStatusKind.HARDWARE_ERROR, "Hardware error"),
            0x00080000: PrinterStatusInfo(raw_code, PrinterStatusKind.SYSTEM_ERROR, "System error"),
            0x00100001: PrinterStatusInfo(raw_code, PrinterStatusKind.FLASH_PROGRAMMING, "Flash programming idle"),
            0x00100002: PrinterStatusInfo(raw_code, PrinterStatusKind.FLASH_PROGRAMMING, "Flash programming writing"),
            0x00100004: PrinterStatusInfo(raw_code, PrinterStatusKind.FLASH_PROGRAMMING, "Flash programming finished"),
            0x00100008: PrinterStatusInfo(raw_code, PrinterStatusKind.FLASH_PROGRAMMING, "Flash programming data error"),
            0x00100010: PrinterStatusInfo(raw_code, PrinterStatusKind.FLASH_PROGRAMMING, "Flash programming device error"),
            0x00100020: PrinterStatusInfo(raw_code, PrinterStatusKind.FLASH_PROGRAMMING, "Flash programming other error"),
            0x00200011: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: jamming supply"),
            0x00200013: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: jamming pass"),
            0x00200017: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: jamming shell"),
            0x0020001B: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: jamming eject"),
            0x0020001E: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: jamming remove"),
            0x00200031: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: capstan motor"),
            0x00200041: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: shell motor"),
            0x00200051: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: pinch"),
            0x00200061: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: pass guide"),
            0x00200071: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: skew guide"),
            0x00200081: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: skew reject"),
            0x00200091: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: shell rotate"),
            0x002000A1: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: lever"),
            0x002000B1: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: cutter"),
            0x002000C1: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: tray out"),
            0x002000D1: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: cover out"),
            0x002000F1: PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error: system"),
        }
        if status in mapping:
            return mapping[status]
        if (status & 0xFFF00000) == 0x00200000:
            return PrinterStatusInfo(raw_code, PrinterStatusKind.UNIT_ERROR, "Unit error")
        return PrinterStatusInfo(raw_code, PrinterStatusKind.UNKNOWN, "Unknown")

    @staticmethod
    def _parse_integer_after_prefix(raw: str, prefix_length: int) -> int | None:
        if len(raw) <= prefix_length:
            return DnpParsers._extract_trailing_int(raw)
        digits = "".join(ch for ch in raw[prefix_length:] if ch.isdigit())
        if digits:
            try:
                return int(digits)
            except ValueError:
                pass
        return DnpParsers._extract_trailing_int(raw)

    @staticmethod
    def _extract_trailing_int(raw: str) -> int | None:
        match = DnpParsers._trailing_number_regex.search(raw)
        if not match:
            return None
        try:
            return int(match.group(0))
        except ValueError:
            return None

    @staticmethod
    def _extract_first_digits(raw: str, minimum_length: int) -> str | None:
        match = DnpParsers._digit_run_regex.search(raw)
        if not match:
            return None
        return match.group(0) if len(match.group(0)) >= minimum_length else None


class DnpModelResolver:
    _reserved_tokens = {"DNP", "CITIZEN", "PRINTER", "PHOTO", "SYSTEM", "STATUS", "MEDIA", "USB"}
    _generic_model_regex = re.compile(r"\b([A-Z]{1,5}-?\d{1,5}[A-Z0-9-]*)\b", re.IGNORECASE)

    @staticmethod
    def normalize(value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return value.strip().lstrip("-")

    @staticmethod
    def is_potential_dnp_printer_text(value: str | None) -> bool:
        if not value or not value.strip():
            return False
        upper = value.upper()
        return "DNP" in upper or "CITIZEN" in upper or DnpModelResolver._try_detect_known_models(value) is not None

    @staticmethod
    def matches_hint(hint: str | None, *values: str | None) -> bool:
        normalized_hint = DnpModelResolver._compact(hint)
        if not normalized_hint:
            return False
        return any(normalized_hint in DnpModelResolver._compact(v) for v in values if v is not None)

    @staticmethod
    def try_detect_from_text(*values: str | None) -> str | None:
        for value in values:
            if not value or not value.strip():
                continue
            known = DnpModelResolver._try_detect_known_models(value)
            if known is not None:
                return known
            generic = DnpModelResolver._try_extract_generic_model(value)
            if generic is not None:
                return generic
        return None

    @staticmethod
    def _try_detect_known_models(value: str) -> str | None:
        compact = DnpModelResolver._compact(value)
        if "DS620" in compact:
            return "DS620"
        if "QW410" in compact:
            return "QW410"
        if "CZ01" in compact:
            return "CZ-01"
        return None

    @staticmethod
    def _try_extract_generic_model(value: str) -> str | None:
        if not DnpModelResolver.is_potential_dnp_printer_text(value):
            return None
        for match in DnpModelResolver._generic_model_regex.finditer(value.upper()):
            token = match.group(1).strip()
            if token and token not in DnpModelResolver._reserved_tokens:
                return token
        return None

    @staticmethod
    def _compact(value: str | None) -> str:
        if not value:
            return ""
        return "".join(ch.upper() for ch in value if ch.isalnum())


class DnpProtocolClient:
    def __init__(self, transport: IDnpTransport, media_type_mapper: DefaultMediaTypeMapper | None = None) -> None:
        self._transport = transport
        self._media_type_mapper = media_type_mapper or DefaultMediaTypeMapper()

    def get_printer_status(self) -> PrinterStatusInfo:
        response = self._query(DnpCommands.STATUS)
        return DnpParsers.parse_status(response)

    def get_remaining_prints(self) -> RemainingPrintsInfo:
        response = self._query(DnpCommands.REMAINING_PRINTS)
        return DnpParsers.parse_remaining_prints(response)

    def get_media_type(self) -> MediaTypeInfo:
        response = self._query(DnpCommands.MEDIA)
        return DnpParsers.parse_media_type(response, self._media_type_mapper)

    def get_free_buffer(self) -> FreeBufferInfo:
        response = self._query(DnpCommands.FREE_BUFFER)
        return DnpParsers.parse_free_buffer(response)

    def probe(self) -> PrinterProbeResult:
        status = self.get_printer_status()
        remaining = self.get_remaining_prints()
        media = self.get_media_type()
        free_buffer = self.get_free_buffer()
        return PrinterProbeResult(status, remaining, media, free_buffer)

    def _query(self, command: DnpCommand) -> str:
        raw_response = self._transport.query(command)
        return DnpPacketCodec.decode_ascii_payload(raw_response)


class SimulationTransport:
    def query(self, command: DnpCommand) -> bytes:
        if command.arg1.lower() == DnpCommands.STATUS.arg1.lower():
            response = "00000"
        elif command.arg1.lower() == DnpCommands.REMAINING_PRINTS.arg1.lower() and command.arg2.lower() == DnpCommands.REMAINING_PRINTS.arg2.lower():
            response = "0347"
        elif command.arg1.lower() == DnpCommands.MEDIA.arg1.lower() and command.arg2.lower() == DnpCommands.MEDIA.arg2.lower():
            response = "6x4"
        elif command.arg1.lower() == DnpCommands.FREE_BUFFER.arg1.lower() and command.arg2.lower() == DnpCommands.FREE_BUFFER.arg2.lower():
            response = "FBP1"
        else:
            response = ""
        return response.encode("ascii")


class EnhancedJsonEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, enum.Enum):
            return o.name
        if hasattr(o, "__dataclass_fields__"):
            return asdict(o)
        return super().default(o)


def to_json(value: Any) -> str:
    return json.dumps(value, cls=EnhancedJsonEncoder, indent=2, ensure_ascii=False)


def format_status(status: PrinterStatusInfo) -> str:
    return f"{status.description} ({status.raw_code})"


def resolve_printer_model_from_windows_device_path(device_path: str | None, try_get_model) -> str | None:
    if not device_path or not device_path.strip():
        return None
    normalized = device_path.strip()
    vid_match = re.search(r"vid_([0-9a-f]{4})", normalized, re.IGNORECASE)
    pid_match = re.search(r"pid_([0-9a-f]{4})", normalized, re.IGNORECASE)
    if not vid_match or not pid_match:
        return DnpModelResolver.try_detect_from_text(normalized)
    vid = vid_match.group(1).upper()
    pid = pid_match.group(1).upper()
    return try_get_model(vid, pid) or DnpModelResolver.try_detect_from_text(normalized)
