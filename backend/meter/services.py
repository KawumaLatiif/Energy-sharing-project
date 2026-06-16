import logging
from decimal import Decimal

import requests
from django.conf import settings


logger = logging.getLogger(__name__)


def push_units_to_thingsboard(meter, units, reference_id=""):
    """
    Push unit credit telemetry to ThingsBoard for a specific meter device.
    Returns (ok: bool, message: str).
    """
    token = (meter.iot_device_token or "").strip()
    if not token:
        return False, "Meter has no ThingsBoard device token configured."

    base_url = (getattr(settings, "THINGSBOARD_BASE_URL", "") or "").rstrip("/")
    if not base_url:
        return False, "THINGSBOARD_BASE_URL is not configured."

    payload = {
        "payment": True,
        "amount": float(Decimal(str(units))),
    }
    if reference_id:
        payload["tx_ref"] = reference_id

    url = f"{base_url}/api/v1/{token}/telemetry"
    timeout = int(getattr(settings, "THINGSBOARD_TIMEOUT_SECONDS", 8))

    try:
        response = requests.post(url, json=payload, timeout=timeout)
        if 200 <= response.status_code < 300:
            return True, "ThingsBoard push successful."
        logger.warning(
            "ThingsBoard push failed for meter=%s status=%s body=%s",
            meter.meter_no,
            response.status_code,
            response.text[:300],
        )
        return False, f"ThingsBoard rejected telemetry (HTTP {response.status_code})."
    except requests.RequestException as exc:
        logger.exception("ThingsBoard request failed for meter=%s", meter.meter_no)
        return False, f"ThingsBoard request failed: {exc.__class__.__name__}"
