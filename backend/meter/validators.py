import re

METER_NO_MIN_LEN = 3
METER_NO_MAX_LEN = 100
# Legacy numeric meters (10–12 digits) or alphanumeric codes (e.g. EM_SRT002).
METER_NO_PATTERN = re.compile(r"^(?:\d{10,12}|[A-Za-z0-9][A-Za-z0-9_-]{2,99})$")


def normalize_meter_no(value: str) -> str:
    return (value or "").strip()


def validate_meter_no(value: str) -> tuple[bool, str]:
    meter_no = normalize_meter_no(value)
    if not meter_no:
        return False, "Meter number is required."
    if len(meter_no) < METER_NO_MIN_LEN:
        return False, f"Meter number must be at least {METER_NO_MIN_LEN} characters."
    if len(meter_no) > METER_NO_MAX_LEN:
        return False, f"Meter number must be at most {METER_NO_MAX_LEN} characters."
    if not METER_NO_PATTERN.match(meter_no):
        return (
            False,
            "Invalid meter number. Use letters, numbers, underscores, or hyphens.",
        )
    return True, meter_no
