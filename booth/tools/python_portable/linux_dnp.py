from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass

from common_dnp import DnpCommand, DnpModelResolver, DnpPacketCodec, PrinterDetectionResult


@dataclass(frozen=True)
class LinuxUsbDeviceInfo:
    device_path: str
    product_name: str | None
    manufacturer: str | None
    vendor_id: str | None
    product_id: str | None
    serial_number: str | None
    bus_number: int | None
    device_address: int | None

    def build_query_value(self) -> str:
        if self.vendor_id and self.product_id:
            selector = f"usb:vid={self.vendor_id},pid={self.product_id}"
            if self.serial_number:
                return selector + f",serial={self.serial_number}"
            if self.bus_number is not None and self.device_address is not None:
                return selector + f",bus={self.bus_number:03d},addr={self.device_address:03d}"
            return selector
        return self.device_path

    def looks_like_dnp(self, model_hint: str | None = None) -> bool:
        return (
            (self.vendor_id or "").lower() == "1343"
            or DnpModelResolver.is_potential_dnp_printer_text(self.product_name)
            or DnpModelResolver.is_potential_dnp_printer_text(self.manufacturer)
            or DnpModelResolver.matches_hint(model_hint, self.product_name, self.manufacturer, self.device_path, self.serial_number)
        )

    def matches_selector(self, selector: "LinuxUsbDeviceSelector") -> bool:
        if selector.device_path and self.device_path.lower() != selector.device_path.lower():
            return False
        if selector.vendor_id and (self.vendor_id or "").lower() != selector.vendor_id.lower():
            return False
        if selector.product_id and (self.product_id or "").lower() != selector.product_id.lower():
            return False
        if selector.serial_number and (self.serial_number or "") != selector.serial_number:
            return False
        if selector.bus_number is not None and self.bus_number != selector.bus_number:
            return False
        if selector.device_address is not None and self.device_address != selector.device_address:
            return False
        return True


@dataclass(frozen=True)
class LinuxUsbDeviceSelector:
    device_path: str | None
    vendor_id: str | None
    product_id: str | None
    serial_number: str | None
    bus_number: int | None
    device_address: int | None

    @staticmethod
    def try_parse(text: str | None) -> "LinuxUsbDeviceSelector | None":
        if not text or not text.strip():
            return None
        trimmed = text.strip()
        if not trimmed.lower().startswith("usb:"):
            return None
        device_path = None
        vendor_id = None
        product_id = None
        serial_number = None
        bus_number = None
        device_address = None
        for part in [p.strip() for p in trimmed[4:].split(",") if p.strip()]:
            if "=" not in part:
                continue
            key, value = [x.strip() for x in part.split("=", 1)]
            if not value:
                continue
            key = key.lower()
            if key == "path":
                device_path = value
            elif key == "vid":
                vendor_id = LinuxUsbDeviceSelector._normalize_hex(value)
            elif key == "pid":
                product_id = LinuxUsbDeviceSelector._normalize_hex(value)
            elif key == "serial":
                serial_number = value
            elif key == "bus":
                bus_number = LinuxUsbDeviceSelector._parse_int(value)
            elif key in {"addr", "device", "dev"}:
                device_address = LinuxUsbDeviceSelector._parse_int(value)
        return LinuxUsbDeviceSelector(device_path, vendor_id, product_id, serial_number, bus_number, device_address)

    @staticmethod
    def _parse_int(text: str) -> int | None:
        try:
            return int(text)
        except ValueError:
            return None

    @staticmethod
    def _normalize_hex(value: str) -> str:
        trimmed = value.strip().lstrip("0")
        if not trimmed:
            return "0000"
        return trimmed.rjust(4, "0").lower()


class LinuxUsbDeviceCatalog:
    DEFAULT_DEVICE_CANDIDATES = [
        "/dev/usb/lp0",
        "/dev/usb/lp1",
        "/dev/usb/lp2",
        "/dev/usb/lp3",
        "/dev/lp0",
        "/dev/lp1",
        "/dev/lp2",
    ]

    @staticmethod
    def enumerate(preferred_device_path: str | None = None) -> list[LinuxUsbDeviceInfo]:
        results: list[LinuxUsbDeviceInfo] = []
        seen: set[str] = set()
        for path in LinuxUsbDeviceCatalog._get_device_candidates(preferred_device_path):
            lowered = path.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            results.append(LinuxUsbDeviceCatalog._read_usb_device_info(path))
        return results

    @staticmethod
    def resolve(query_value: str | None) -> LinuxUsbDeviceInfo | None:
        if not query_value or not query_value.strip():
            devices = LinuxUsbDeviceCatalog.enumerate()
            return devices[0] if devices else None
        trimmed = query_value.strip()
        selector = LinuxUsbDeviceSelector.try_parse(trimmed)
        if selector is None:
            return LinuxUsbDeviceCatalog._read_usb_device_info(trimmed) if os.path.exists(trimmed) else None
        for device in LinuxUsbDeviceCatalog.enumerate(selector.device_path):
            if device.matches_selector(selector):
                return device
        return None

    @staticmethod
    def _get_device_candidates(preferred_device_path: str | None):
        if preferred_device_path and preferred_device_path.strip() and not preferred_device_path.strip().lower().startswith("usb:"):
            yield preferred_device_path.strip()
        for path in LinuxUsbDeviceCatalog.DEFAULT_DEVICE_CANDIDATES:
            if os.path.exists(path):
                yield path

    @staticmethod
    def _read_usb_device_info(device_path: str) -> LinuxUsbDeviceInfo:
        base_name = os.path.basename(device_path)
        candidate_roots = [
            os.path.join("/sys/class/usb", base_name),
            os.path.join("/sys/class/usblp", base_name),
        ]
        for root in candidate_roots:
            if not os.path.isdir(root):
                continue
            metadata = LinuxUsbDeviceCatalog._read_metadata_from_ancestors(os.path.join(root, "device"))
            return LinuxUsbDeviceInfo(device_path, *metadata)
        return LinuxUsbDeviceInfo(device_path, None, None, None, None, None, None, None)

    @staticmethod
    def _read_metadata_from_ancestors(start_path: str):
        current = os.path.abspath(start_path)
        while True:
            if not os.path.isdir(current):
                parent = os.path.dirname(current)
                if parent == current:
                    break
                current = parent
                continue
            product = LinuxUsbDeviceCatalog._read_text_file(os.path.join(current, "product"))
            manufacturer = LinuxUsbDeviceCatalog._read_text_file(os.path.join(current, "manufacturer"))
            vendor_id = LinuxUsbDeviceCatalog._normalize_hex_or_none(LinuxUsbDeviceCatalog._read_text_file(os.path.join(current, "idVendor")))
            product_id = LinuxUsbDeviceCatalog._normalize_hex_or_none(LinuxUsbDeviceCatalog._read_text_file(os.path.join(current, "idProduct")))
            serial = LinuxUsbDeviceCatalog._read_text_file(os.path.join(current, "serial"))
            bus_number = LinuxUsbDeviceCatalog._read_int_file(os.path.join(current, "busnum"))
            device_address = LinuxUsbDeviceCatalog._read_int_file(os.path.join(current, "devnum"))
            if any(x is not None for x in [product, manufacturer, vendor_id, product_id, serial]):
                return product, manufacturer, vendor_id, product_id, serial, bus_number, device_address
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent
        return None, None, None, None, None, None, None

    @staticmethod
    def _read_text_file(path: str) -> str | None:
        if not os.path.exists(path):
            return None
        try:
            value = open(path, "r", encoding="utf-8", errors="ignore").read().strip()
        except OSError:
            return None
        return value or None

    @staticmethod
    def _read_int_file(path: str) -> int | None:
        value = LinuxUsbDeviceCatalog._read_text_file(path)
        if value is None:
            return None
        try:
            return int(value)
        except ValueError:
            return None

    @staticmethod
    def _normalize_hex_or_none(value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        trimmed = value.strip().lstrip("0")
        if not trimmed:
            return "0000"
        return trimmed.rjust(4, "0").lower()


class LinuxUsbPrinterTransport:
    def __init__(self, device_path: str | None = None, read_chunk_size: int = 4096, read_timeout_ms: int = 5000, post_write_delay_ms: int = 75) -> None:
        self._device_path = device_path.strip() if device_path and device_path.strip() else None
        self._read_chunk_size = max(256, int(read_chunk_size))
        self._read_timeout_ms = max(250, int(read_timeout_ms))
        self._post_write_delay_ms = max(0, int(post_write_delay_ms))

    def query(self, command: DnpCommand) -> bytes:
        if os.name != "posix" or not hasattr(os, "uname") or os.uname().sysname.lower() != "linux":
            raise OSError("Linux transport can only run on Linux.")
        device_path = self._resolve_device_path()
        with open(device_path, "r+b", buffering=0) as stream:
            stream.write(command.encode())
            stream.flush()
            if self._post_write_delay_ms > 0:
                import time
                time.sleep(self._post_write_delay_ms / 1000.0)
            return self._read_response(stream)

    def _read_response(self, stream) -> bytes:
        response = bytearray()
        with ThreadPoolExecutor(max_workers=1) as pool:
            while True:
                future = pool.submit(stream.read, self._read_chunk_size)
                try:
                    chunk = future.result(timeout=self._read_timeout_ms / 1000.0)
                except FutureTimeoutError:
                    future.cancel()
                    if not response:
                        raise TimeoutError(f"No response received from device within {self._read_timeout_ms} ms.")
                    break
                if not chunk:
                    if not response:
                        raise TimeoutError(f"No response received from device within {self._read_timeout_ms} ms.")
                    break
                response.extend(chunk)
                expected_length = DnpPacketCodec.try_get_expected_response_length(response)
                if expected_length is not None and len(response) >= expected_length:
                    break
        return bytes(response)

    def _resolve_device_path(self) -> str:
        explicit = self._try_resolve_device_path(self._device_path)
        if explicit:
            return explicit
        env_path = os.environ.get("DNP_PRINTER_DEVICE", "")
        env = self._try_resolve_device_path(env_path)
        if env:
            return env
        devices = LinuxUsbDeviceCatalog.enumerate()
        if devices:
            return devices[0].device_path
        raise RuntimeError("No Linux printer device could be selected automatically. Pass --device /dev/usb/lp0 or --device usb:vid=1343,pid=000c,... or set DNP_PRINTER_DEVICE.")

    @staticmethod
    def _try_resolve_device_path(query_value: str | None) -> str | None:
        if not query_value or not query_value.strip():
            return None
        trimmed = query_value.strip()
        if not trimmed.lower().startswith("usb:"):
            return trimmed if os.path.exists(trimmed) else None
        resolved = LinuxUsbDeviceCatalog.resolve(trimmed)
        if resolved and resolved.device_path:
            return resolved.device_path
        return None


class LinuxPrinterDetector:
    @staticmethod
    def detect(explicit_device_path: str | None = None, model_hint: str | None = None) -> PrinterDetectionResult:
        is_linux = os.name == "posix" and hasattr(os, "uname") and os.uname().sysname.lower() == "linux"
        if not is_linux:
            return PrinterDetectionResult(False, False, "linux", "--device", None, None, None, None, None, None, None, None, None, None, None, None, None, "Linux detection can only run on Linux.", None, None)
        preferred_device = explicit_device_path.strip() if explicit_device_path and explicit_device_path.strip() else os.environ.get("DNP_PRINTER_DEVICE", "").strip() or None
        preferred_hint = DnpModelResolver.normalize(model_hint)
        devices = LinuxUsbDeviceCatalog.enumerate(preferred_device)
        for device in devices:
            if not device.looks_like_dnp(preferred_hint):
                continue
            query_value = device.build_query_value()
            model = DnpModelResolver.try_detect_from_text(device.product_name, device.manufacturer, preferred_hint)
            printer_name = device.product_name or model
            if device.device_path.lower() == (preferred_device or "").lower():
                reason = "Matched explicit Linux printer device."
            elif query_value.lower().startswith("usb:"):
                reason = "Matched Linux USB metadata and built a stable query selector."
            else:
                reason = "Matched Linux USB product information."
            return PrinterDetectionResult(
                True,
                True,
                "linux",
                "--device",
                query_value,
                None,
                printer_name,
                device.device_path,
                model,
                device.product_name,
                device.manufacturer,
                None,
                device.vendor_id,
                device.product_id,
                device.serial_number,
                device.bus_number,
                device.device_address,
                reason,
                None,
                None,
            )
        return PrinterDetectionResult(
            False,
            False,
            "linux",
            "--device",
            None,
            None,
            None,
            preferred_device,
            DnpModelResolver.try_detect_from_text(preferred_hint),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            "No DNP/Citizen USB printer could be identified from Linux devices.",
            None,
            None,
        )
