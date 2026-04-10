from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import os
import re
import uuid
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from typing import Iterable

from common_dnp import DnpCommand, DnpModelResolver, DnpPacketCodec, PrinterDetectionResult


# Some Python builds on Windows do not expose every alias in ctypes.wintypes
# (notably ULONG_PTR). Define portable fallbacks here.
WIN_ULONG = getattr(wt, "ULONG", wt.DWORD)
if hasattr(wt, "ULONG_PTR"):
    WIN_ULONG_PTR = wt.ULONG_PTR
else:
    WIN_ULONG_PTR = ctypes.c_uint64 if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_uint32


PAIR_TO_MODEL: dict[str, str] = {
    "1452:9201": "QW410",
    "1343:FFFF": "DS620",
    "1343:1001": "DS820",
    "1452:9401": "DS40",
    "1452:9001": "DS80",
    "1343:0009": "RX1",
    "1452:9301": "CX-02",
    "1452:8B02": "CX-W",
    "1452:8B01": "CZ-01",
    "1343:0008": "DS-RX1HS",
    "1343:0007": "DS40",
    "1343:0006": "DS80",
    "1343:0005": "CX",
    "1343:0004": "DS80D",
    "1343:0003": "DS80DX",
    "1343:0002": "DS40D",
    "1343:0001": "DS40DX",
}
ALLOWED_PAIRS = set(PAIR_TO_MODEL)
VID_PID_REGEX = re.compile(r"VID_([0-9A-F]{4})&PID_([0-9A-F]{4})", re.IGNORECASE)


@dataclass(frozen=True)
class WindowsUsbIdentity:
    printer_name: str | None
    pnp_instance_id: str | None
    usb_print_instance_id: str | None
    usb_instance_id: str | None
    vendor_id: str | None
    product_id: str | None
    serial_number: str | None
    device_description: str | None
    friendly_name: str | None


@dataclass(frozen=True)
class WindowsPnPDeviceInfo:
    instance_id: str
    class_name: str | None
    friendly_name: str | None
    device_description: str | None
    dev_inst: int


@dataclass(frozen=True)
class InterfaceInfo:
    device_path: str
    device_instance_id: str | None
    interface_guid: str


class WindowsUsbVidPidCatalog:
    @staticmethod
    def is_known_dnp_pair(vendor_id: str | None, product_id: str | None) -> bool:
        if not vendor_id or not product_id:
            return False
        return f"{vendor_id.strip().upper()}:{product_id.strip().upper()}" in ALLOWED_PAIRS

    @staticmethod
    def get_known_pairs() -> set[str]:
        return set(ALLOWED_PAIRS)

    @staticmethod
    def try_get_model(vendor_id: str | None, product_id: str | None) -> str | None:
        if not vendor_id or not product_id:
            return None
        return PAIR_TO_MODEL.get(f"{vendor_id.strip().upper()}:{product_id.strip().upper()}")


if os.name == "nt":
    INVALID_HANDLE_VALUE = wt.HANDLE(-1).value
    DIGCF_PRESENT = 0x00000002
    DIGCF_ALLCLASSES = 0x00000004
    DIGCF_DEVICEINTERFACE = 0x00000010
    ERROR_NO_MORE_ITEMS = 259
    ERROR_INVALID_DATA = 13
    ERROR_FILE_NOT_FOUND = 2
    ERROR_INSUFFICIENT_BUFFER = 122
    ERROR_IO_PENDING = 997
    ERROR_OPERATION_ABORTED = 995
    GENERIC_READ = 0x80000000
    GENERIC_WRITE = 0x40000000
    FILE_SHARE_READ = 0x00000001
    FILE_SHARE_WRITE = 0x00000002
    OPEN_EXISTING = 3
    FILE_ATTRIBUTE_NORMAL = 0x00000080
    SPDRP_DEVICEDESC = 0x00000000
    SPDRP_CLASS = 0x00000007
    SPDRP_FRIENDLYNAME = 0x0000000C

    setupapi = ctypes.WinDLL("setupapi.dll", use_last_error=True)
    cfgmgr32 = ctypes.WinDLL("cfgmgr32.dll", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32.dll", use_last_error=True)

    class GUID(ctypes.Structure):
        _fields_ = [
            ("Data1", wt.DWORD),
            ("Data2", wt.WORD),
            ("Data3", wt.WORD),
            ("Data4", ctypes.c_ubyte * 8),
        ]

        @classmethod
        def from_string(cls, text: str) -> "GUID":
            u = uuid.UUID(text)
            data = u.bytes_le
            return cls(
                int.from_bytes(data[0:4], "little"),
                int.from_bytes(data[4:6], "little"),
                int.from_bytes(data[6:8], "little"),
                (ctypes.c_ubyte * 8)(*data[8:16]),
            )

    class SP_DEVINFO_DATA(ctypes.Structure):
        _fields_ = [
            ("cbSize", wt.DWORD),
            ("ClassGuid", GUID),
            ("DevInst", wt.DWORD),
            ("Reserved", WIN_ULONG_PTR),
        ]

    class SP_DEVICE_INTERFACE_DATA(ctypes.Structure):
        _fields_ = [
            ("cbSize", wt.DWORD),
            ("InterfaceClassGuid", GUID),
            ("Flags", wt.DWORD),
            ("Reserved", WIN_ULONG_PTR),
        ]

    setupapi.SetupDiGetClassDevsW.argtypes = [ctypes.c_void_p, wt.LPCWSTR, wt.HWND, wt.DWORD]
    setupapi.SetupDiGetClassDevsW.restype = wt.HANDLE
    setupapi.SetupDiEnumDeviceInfo.argtypes = [wt.HANDLE, wt.DWORD, ctypes.POINTER(SP_DEVINFO_DATA)]
    setupapi.SetupDiEnumDeviceInfo.restype = wt.BOOL
    setupapi.SetupDiGetDeviceInstanceIdW.argtypes = [wt.HANDLE, ctypes.POINTER(SP_DEVINFO_DATA), wt.LPWSTR, wt.DWORD, ctypes.POINTER(wt.DWORD)]
    setupapi.SetupDiGetDeviceInstanceIdW.restype = wt.BOOL
    setupapi.SetupDiGetDeviceRegistryPropertyW.argtypes = [wt.HANDLE, ctypes.POINTER(SP_DEVINFO_DATA), wt.DWORD, ctypes.POINTER(wt.DWORD), ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD)]
    setupapi.SetupDiGetDeviceRegistryPropertyW.restype = wt.BOOL
    setupapi.SetupDiDestroyDeviceInfoList.argtypes = [wt.HANDLE]
    setupapi.SetupDiDestroyDeviceInfoList.restype = wt.BOOL
    setupapi.SetupDiEnumDeviceInterfaces.argtypes = [wt.HANDLE, ctypes.c_void_p, ctypes.POINTER(GUID), wt.DWORD, ctypes.POINTER(SP_DEVICE_INTERFACE_DATA)]
    setupapi.SetupDiEnumDeviceInterfaces.restype = wt.BOOL
    setupapi.SetupDiGetDeviceInterfaceDetailW.argtypes = [wt.HANDLE, ctypes.POINTER(SP_DEVICE_INTERFACE_DATA), ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD), ctypes.POINTER(SP_DEVINFO_DATA)]
    setupapi.SetupDiGetDeviceInterfaceDetailW.restype = wt.BOOL

    cfgmgr32.CM_Get_Device_IDW.argtypes = [wt.DWORD, wt.LPWSTR, WIN_ULONG, WIN_ULONG]
    cfgmgr32.CM_Get_Device_IDW.restype = ctypes.c_uint
    cfgmgr32.CM_Get_Parent.argtypes = [ctypes.POINTER(wt.DWORD), wt.DWORD, WIN_ULONG]
    cfgmgr32.CM_Get_Parent.restype = ctypes.c_uint

    kernel32.CreateFileW.argtypes = [wt.LPCWSTR, wt.DWORD, wt.DWORD, ctypes.c_void_p, wt.DWORD, wt.DWORD, wt.HANDLE]
    kernel32.CreateFileW.restype = wt.HANDLE
    kernel32.ReadFile.argtypes = [wt.HANDLE, ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD), ctypes.c_void_p]
    kernel32.ReadFile.restype = wt.BOOL
    kernel32.WriteFile.argtypes = [wt.HANDLE, ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD), ctypes.c_void_p]
    kernel32.WriteFile.restype = wt.BOOL
    kernel32.FlushFileBuffers.argtypes = [wt.HANDLE]
    kernel32.FlushFileBuffers.restype = wt.BOOL
    kernel32.CloseHandle.argtypes = [wt.HANDLE]
    kernel32.CloseHandle.restype = wt.BOOL
    kernel32.CancelIoEx.argtypes = [wt.HANDLE, ctypes.c_void_p]
    kernel32.CancelIoEx.restype = wt.BOOL

    PRINTER_INTERFACE_GUID = GUID.from_string("28d78fad-5a12-11D1-ae5b-0000f803a8c2")
    USB_DEVICE_INTERFACE_GUID = GUID.from_string("A5DCBF10-6530-11D2-901F-00C04FB951ED")


def _check_windows() -> None:
    if os.name != "nt":
        raise OSError("Windows-only code called on non-Windows platform.")


def _contains(value: str | None, needle: str) -> bool:
    return bool(value) and needle.lower() in value.lower()


def _parse_vid_pid(usb_instance_id: str | None) -> tuple[str | None, str | None]:
    if not usb_instance_id:
        return None, None
    match = VID_PID_REGEX.search(usb_instance_id)
    if not match:
        return None, None
    return match.group(1).upper(), match.group(2).upper()


def _parse_serial_from_usb_instance_id(usb_instance_id: str | None) -> str | None:
    if not usb_instance_id:
        return None
    parts = [p for p in usb_instance_id.split("\\") if p]
    return parts[2] if len(parts) >= 3 else None


def _compact_guid_text(guid: GUID) -> str:
    return str(uuid.UUID(bytes_le=bytes(memoryview(guid)))).lower()


def _get_class_devs_all_present() -> int:
    handle = setupapi.SetupDiGetClassDevsW(None, None, None, DIGCF_ALLCLASSES | DIGCF_PRESENT)
    if handle in (0, INVALID_HANDLE_VALUE):
        return 0
    return int(handle)


def _get_class_devs_for_interface(interface_guid: GUID) -> int:
    handle = setupapi.SetupDiGetClassDevsW(ctypes.byref(interface_guid), None, None, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE)
    if handle in (0, INVALID_HANDLE_VALUE):
        return 0
    return int(handle)


def _get_device_instance_id(handle: int, data: SP_DEVINFO_DATA) -> str:
    buffer = ctypes.create_unicode_buffer(512)
    required = wt.DWORD()
    ok = setupapi.SetupDiGetDeviceInstanceIdW(wt.HANDLE(handle), ctypes.byref(data), buffer, len(buffer), ctypes.byref(required))
    if not ok:
        raise ctypes.WinError(ctypes.get_last_error())
    return buffer.value


def _get_device_id(dev_inst: int) -> str | None:
    buffer = ctypes.create_unicode_buffer(512)
    result = cfgmgr32.CM_Get_Device_IDW(dev_inst, buffer, len(buffer), 0)
    return buffer.value if result == 0 else None


def _get_property(handle: int, data: SP_DEVINFO_DATA, prop: int) -> str | None:
    buffer_size = 1024
    while True:
        raw = (ctypes.c_ubyte * buffer_size)()
        reg_type = wt.DWORD()
        required = wt.DWORD()
        ok = setupapi.SetupDiGetDeviceRegistryPropertyW(
            wt.HANDLE(handle),
            ctypes.byref(data),
            prop,
            ctypes.byref(reg_type),
            raw,
            buffer_size,
            ctypes.byref(required),
        )
        if ok:
            break
        error = ctypes.get_last_error()
        if error in (ERROR_INVALID_DATA, ERROR_FILE_NOT_FOUND):
            return None
        if error == ERROR_INSUFFICIENT_BUFFER and required.value > buffer_size:
            buffer_size = int(required.value)
            continue
        return None

    if required.value <= 2:
        return None

    usable = min(int(required.value), buffer_size)
    data_bytes = bytes(raw[: usable - 2])
    return data_bytes.decode("utf-16-le", errors="ignore").strip("\x00 ") or None


def enumerate_devices() -> list[WindowsPnPDeviceInfo]:
    _check_windows()
    handle = _get_class_devs_all_present()
    if not handle:
        return []
    items: list[WindowsPnPDeviceInfo] = []
    try:
        index = 0
        while True:
            data = SP_DEVINFO_DATA()
            data.cbSize = ctypes.sizeof(SP_DEVINFO_DATA)
            ok = setupapi.SetupDiEnumDeviceInfo(wt.HANDLE(handle), index, ctypes.byref(data))
            if not ok:
                error = ctypes.get_last_error()
                if error == ERROR_NO_MORE_ITEMS:
                    break
                raise ctypes.WinError(error)
            instance_id = _get_device_instance_id(handle, data)
            class_name = _get_property(handle, data, SPDRP_CLASS)
            friendly_name = _get_property(handle, data, SPDRP_FRIENDLYNAME)
            device_description = _get_property(handle, data, SPDRP_DEVICEDESC)
            items.append(WindowsPnPDeviceInfo(instance_id, class_name, friendly_name, device_description, int(data.DevInst)))
            index += 1
    finally:
        setupapi.SetupDiDestroyDeviceInfoList(wt.HANDLE(handle))
    return items


def _find_usb_parent_instance_id_from_dev_inst(child_dev_inst: int) -> str | None:
    current = wt.DWORD(child_dev_inst)
    for _ in range(8):
        current_id = _get_device_id(int(current.value))
        if current_id and current_id.upper().startswith("USB\\VID_"):
            return current_id
        parent = wt.DWORD()
        result = cfgmgr32.CM_Get_Parent(ctypes.byref(parent), current, 0)
        if result != 0:
            break
        current = parent
    return None


def _get_device_instance(instance_id: str) -> int | None:
    handle = _get_class_devs_all_present()
    if not handle:
        return None
    try:
        index = 0
        while True:
            data = SP_DEVINFO_DATA()
            data.cbSize = ctypes.sizeof(SP_DEVINFO_DATA)
            ok = setupapi.SetupDiEnumDeviceInfo(wt.HANDLE(handle), index, ctypes.byref(data))
            if not ok:
                error = ctypes.get_last_error()
                if error == ERROR_NO_MORE_ITEMS:
                    break
                raise ctypes.WinError(error)
            current_id = _get_device_instance_id(handle, data)
            if current_id.lower() == instance_id.lower():
                return int(data.DevInst)
            index += 1
    finally:
        setupapi.SetupDiDestroyDeviceInfoList(wt.HANDLE(handle))
    return None


def _find_usb_parent_instance_id_from_instance_id(device_instance_id: str) -> str | None:
    dev_inst = _get_device_instance(device_instance_id)
    if dev_inst is None:
        return None
    return _find_usb_parent_instance_id_from_dev_inst(dev_inst)


def _score(device: WindowsPnPDeviceInfo, preferred_printer_name: str | None, model_hint: str | None) -> int:
    score = 0
    if preferred_printer_name:
        if (device.friendly_name or "").lower() == preferred_printer_name.lower() or (device.device_description or "").lower() == preferred_printer_name.lower():
            score += 50
        if _contains(device.instance_id, preferred_printer_name):
            score += 20
    if model_hint and DnpModelResolver.matches_hint(model_hint, device.friendly_name, device.device_description, device.instance_id):
        score += 30
    if DnpModelResolver.is_potential_dnp_printer_text(device.friendly_name) or DnpModelResolver.is_potential_dnp_printer_text(device.device_description) or DnpModelResolver.is_potential_dnp_printer_text(device.instance_id):
        score += 10
    if device.instance_id.upper().startswith("USBPRINT\\"):
        score += 10
    if device.instance_id.upper().startswith("USB\\VID_"):
        score += 25
    return score


def _is_physical_usb_candidate(device: WindowsPnPDeviceInfo) -> bool:
    iid = device.instance_id.upper()
    if iid.startswith("USB\\VID_"):
        vid, pid = _parse_vid_pid(device.instance_id)
        return WindowsUsbVidPidCatalog.is_known_dnp_pair(vid, pid)
    if iid.startswith("USBPRINT\\"):
        parent = _find_usb_parent_instance_id_from_dev_inst(device.dev_inst)
        if not parent or not parent.upper().startswith("USB\\VID_"):
            return False
        vid, pid = _parse_vid_pid(parent)
        return WindowsUsbVidPidCatalog.is_known_dnp_pair(vid, pid)
    return False


def try_find_usb_identity(preferred_printer_name: str | None = None, model_hint: str | None = None) -> WindowsUsbIdentity | None:
    if os.name != "nt":
        return None
    devices = enumerate_devices()
    if not devices:
        return None
    preferred = preferred_printer_name.strip() if preferred_printer_name else None
    candidates = [d for d in devices if _is_physical_usb_candidate(d)]
    if not candidates:
        return None
    candidate = max(candidates, key=lambda d: _score(d, preferred, model_hint))
    usb_instance_id = candidate.instance_id if candidate.instance_id.upper().startswith("USB\\VID_") else _find_usb_parent_instance_id_from_dev_inst(candidate.dev_inst)
    if not usb_instance_id or not usb_instance_id.upper().startswith("USB\\VID_"):
        return None
    vendor_id, product_id = _parse_vid_pid(usb_instance_id)
    if not vendor_id or not product_id:
        return None
    if not WindowsUsbVidPidCatalog.is_known_dnp_pair(vendor_id, product_id):
        return None
    usb_print_candidates = [
        x for x in devices
        if x.instance_id.upper().startswith("USBPRINT\\") and (_find_usb_parent_instance_id_from_dev_inst(x.dev_inst) or "").lower() == usb_instance_id.lower()
    ]
    usb_print_instance_id = max(usb_print_candidates, key=lambda d: _score(d, preferred, model_hint)).instance_id if usb_print_candidates else None
    serial = _parse_serial_from_usb_instance_id(usb_instance_id)
    return WindowsUsbIdentity(
        candidate.friendly_name or candidate.device_description,
        candidate.instance_id,
        usb_print_instance_id,
        usb_instance_id,
        vendor_id,
        product_id,
        serial,
        candidate.device_description,
        candidate.friendly_name,
    )


def enumerate_relevant_interfaces() -> list[InterfaceInfo]:
    return [*enumerate_interfaces(PRINTER_INTERFACE_GUID), *enumerate_interfaces(USB_DEVICE_INTERFACE_GUID)] if os.name == "nt" else []


def enumerate_interfaces(interface_guid: GUID) -> Iterable[InterfaceInfo]:
    _check_windows()
    handle = _get_class_devs_for_interface(interface_guid)
    if not handle:
        return []

    def generator() -> Iterable[InterfaceInfo]:
        try:
            index = 0
            while True:
                if_data = SP_DEVICE_INTERFACE_DATA()
                if_data.cbSize = ctypes.sizeof(SP_DEVICE_INTERFACE_DATA)
                loop_guid = interface_guid
                ok = setupapi.SetupDiEnumDeviceInterfaces(wt.HANDLE(handle), None, ctypes.byref(loop_guid), index, ctypes.byref(if_data))
                if not ok:
                    error = ctypes.get_last_error()
                    if error == ERROR_NO_MORE_ITEMS:
                        break
                    raise ctypes.WinError(error)
                dev_info = SP_DEVINFO_DATA()
                dev_info.cbSize = ctypes.sizeof(SP_DEVINFO_DATA)
                required = wt.DWORD()
                setupapi.SetupDiGetDeviceInterfaceDetailW(wt.HANDLE(handle), ctypes.byref(if_data), None, 0, ctypes.byref(required), ctypes.byref(dev_info))
                buffer = ctypes.create_string_buffer(required.value)
                ctypes.c_uint32.from_buffer(buffer).value = 8 if ctypes.sizeof(ctypes.c_void_p) == 8 else 6
                ok = setupapi.SetupDiGetDeviceInterfaceDetailW(wt.HANDLE(handle), ctypes.byref(if_data), buffer, required, ctypes.byref(required), ctypes.byref(dev_info))
                if not ok:
                    raise ctypes.WinError(ctypes.get_last_error())
                device_path = ctypes.wstring_at(ctypes.addressof(buffer) + 4)
                instance_id = _get_device_id(int(dev_info.DevInst))
                yield InterfaceInfo(device_path, instance_id, _compact_guid_text(interface_guid))
                index += 1
        finally:
            setupapi.SetupDiDestroyDeviceInfoList(wt.HANDLE(handle))

    return list(generator())


def _contains_vid_pid(value: str | None, vendor_id: str | None, product_id: str | None) -> bool:
    if not value or not vendor_id or not product_id:
        return False
    lower = value.lower()
    return f"vid_{vendor_id.lower()}" in lower and f"pid_{product_id.lower()}" in lower


def _matches_usb_identity(item: InterfaceInfo, identity: WindowsUsbIdentity) -> bool:
    if not item.device_path:
        return False
    if item.device_path.lower() in {x.lower() for x in [identity.usb_instance_id, identity.usb_print_instance_id, identity.pnp_instance_id] if x}:
        return True
    if item.device_instance_id:
        if item.device_instance_id.lower() in {x.lower() for x in [identity.usb_instance_id, identity.usb_print_instance_id, identity.pnp_instance_id] if x}:
            return True
        parent = _find_usb_parent_instance_id_from_instance_id(item.device_instance_id)
        if identity.usb_instance_id and parent and parent.lower() == identity.usb_instance_id.lower():
            return True
    return _contains_vid_pid(item.device_path, identity.vendor_id, identity.product_id) and (
        not identity.serial_number or identity.serial_number.lower() in item.device_path.lower()
    )


def resolve_device_path(identity: WindowsUsbIdentity | None) -> str | None:
    if os.name != "nt" or not identity or not identity.usb_instance_id:
        return None
    if not WindowsUsbVidPidCatalog.is_known_dnp_pair(identity.vendor_id, identity.product_id):
        return None
    candidates = enumerate_relevant_interfaces()
    for item in candidates:
        if _matches_usb_identity(item, identity):
            return item.device_path
    if identity.vendor_id and identity.product_id:
        for item in candidates:
            if _contains_vid_pid(item.device_path, identity.vendor_id, identity.product_id) or _contains_vid_pid(item.device_instance_id, identity.vendor_id, identity.product_id):
                return item.device_path
    return None


class WindowsUsbPrinterTransport:
    def __init__(
        self,
        printer_name: str | None = None,
        selection_hint: str | None = None,
        port: int | None = None,
        dll_path: str | None = None,
        device_path: str | None = None,
        read_chunk_size: int = 4096,
        read_timeout_ms: int = 5000,
        post_write_delay_ms: int = 75,
    ) -> None:
        self._printer_name = printer_name.strip() if printer_name and printer_name.strip() else None
        self._selection_hint = DnpModelResolver.normalize(selection_hint)
        self._explicit_device_path = device_path.strip() if device_path and device_path.strip() else None
        self._read_chunk_size = max(256, int(read_chunk_size))
        self._read_timeout_ms = max(250, int(read_timeout_ms))
        self._post_write_delay_ms = max(0, int(post_write_delay_ms))

    def query(self, command: DnpCommand) -> bytes:
        if os.name != "nt":
            raise OSError("Windows raw USB transport can only run on Windows.")
        device_path = self.resolve_device_path()
        request_bytes = command.encode()
        handle = self._open_device_handle(device_path)
        try:
            self._write_all(handle, request_bytes)
            try:
                kernel32.FlushFileBuffers(handle)
            except Exception:
                pass
            if self._post_write_delay_ms > 0:
                time.sleep(self._post_write_delay_ms / 1000.0)
            return self._read_response(handle)
        finally:
            kernel32.CloseHandle(handle)

    def resolve_auto_device_path(self) -> str | None:
        identity = try_find_usb_identity(self._printer_name, self._selection_hint)
        return resolve_device_path(identity)

    def resolve_device_path(self) -> str:
        if self._explicit_device_path:
            return self._explicit_device_path
        env_path = os.environ.get("DNP_PRINTER_DEVICE", "").strip()
        if env_path:
            return env_path
        resolved = self.resolve_auto_device_path()
        if resolved:
            return resolved
        raise RuntimeError("No Windows USB printer device path could be selected automatically. Pass --device \\\\?\\usb#... or set DNP_PRINTER_DEVICE.")

    def _open_device_handle(self, device_path: str):
        handle = kernel32.CreateFileW(
            device_path,
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None,
        )
        if handle in (0, INVALID_HANDLE_VALUE):
            raise ctypes.WinError(ctypes.get_last_error())
        return handle

    def _write_all(self, handle, data: bytes) -> None:
        if not data:
            return
        buffer = ctypes.create_string_buffer(data)
        total = 0
        while total < len(data):
            written = wt.DWORD()
            offset_ptr = ctypes.byref(buffer, total)
            ok = kernel32.WriteFile(handle, offset_ptr, len(data) - total, ctypes.byref(written), None)
            if not ok:
                raise ctypes.WinError(ctypes.get_last_error())
            if written.value <= 0:
                raise OSError("WriteFile returned success but wrote zero bytes.")
            total += int(written.value)

    def _read_chunk(self, handle) -> bytes:
        raw = (ctypes.c_ubyte * self._read_chunk_size)()
        read = wt.DWORD()
        ok = kernel32.ReadFile(handle, raw, self._read_chunk_size, ctypes.byref(read), None)
        if not ok:
            error = ctypes.get_last_error()
            if error == ERROR_OPERATION_ABORTED:
                return b""
            raise ctypes.WinError(error)
        return bytes(raw[: read.value])

    def _read_response(self, handle) -> bytes:
        response = bytearray()
        with ThreadPoolExecutor(max_workers=1) as pool:
            while True:
                future = pool.submit(self._read_chunk, handle)
                try:
                    chunk = future.result(timeout=self._read_timeout_ms / 1000.0)
                except FutureTimeoutError:
                    try:
                        kernel32.CancelIoEx(handle, None)
                    except Exception:
                        pass
                    try:
                        future.result(timeout=1.0)
                    except Exception:
                        pass
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


class WindowsPrinterDetector:
    @staticmethod
    def detect(
        explicit_printer_name: str | None = None,
        model_hint: str | None = None,
        explicit_port: int | None = None,
        dll_path: str | None = None,
        start_port: int = 0,
        end_port: int = 7,
    ) -> PrinterDetectionResult:
        if os.name != "nt":
            return PrinterDetectionResult(False, False, "windows", "--device", None, None, None, None, None, None, None, None, None, None, None, None, None, "Windows detection can only run on Windows.", None, None)
        preferred_printer = explicit_printer_name.strip() if explicit_printer_name and explicit_printer_name.strip() else os.environ.get("DNP_PRINTER_NAME", "").strip() or None
        preferred_hint = DnpModelResolver.normalize(model_hint)
        usb_identity = try_find_usb_identity(preferred_printer, preferred_hint)
        if usb_identity is None:
            return PrinterDetectionResult(
                False,
                False,
                "windows",
                "--device",
                None,
                None,
                preferred_printer,
                None,
                DnpModelResolver.try_detect_from_text(preferred_printer, preferred_hint),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                "No matching physical USB DNP printer was found. Allowed VID/PID pairs are filtered from the built-in USB catalog.",
                None,
                None,
            )
        transport = WindowsUsbPrinterTransport(printer_name=preferred_printer, selection_hint=preferred_hint)
        device_path = transport.resolve_auto_device_path()
        resolved_printer_name = preferred_printer or usb_identity.printer_name or usb_identity.friendly_name or usb_identity.device_description
        resolved_model = (
            DnpModelResolver.try_detect_from_text(resolved_printer_name, preferred_hint, usb_identity.friendly_name, usb_identity.device_description)
            or WindowsUsbVidPidCatalog.try_get_model(usb_identity.vendor_id, usb_identity.product_id)
        )
        manufacturer = WindowsPrinterDetector._resolve_manufacturer(resolved_printer_name, usb_identity.friendly_name, usb_identity.device_description)
        query_ready = bool(device_path and device_path.strip())
        reason = (
            "Detected physical USB printer and a matching Windows device interface path."
            if query_ready
            else "Detected physical DNP USB printer, but no usable Windows device interface path was found yet."
        )
        return PrinterDetectionResult(
            True,
            query_ready,
            "windows",
            "--device",
            device_path,
            None,
            resolved_printer_name,
            device_path,
            resolved_model,
            usb_identity.friendly_name or resolved_printer_name,
            manufacturer,
            None,
            usb_identity.vendor_id,
            usb_identity.product_id,
            usb_identity.serial_number,
            None,
            None,
            reason,
            usb_identity.usb_instance_id,
            usb_identity.usb_print_instance_id,
        )

    @staticmethod
    def _resolve_manufacturer(*values: str | None) -> str | None:
        for value in values:
            if not value:
                continue
            upper = value.upper()
            if "CITIZEN" in upper:
                return "Citizen"
            if "DNP" in upper or "MITSUBISHI" in upper:
                return "DNP"
        return None
