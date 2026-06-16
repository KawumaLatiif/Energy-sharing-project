"""
AMI (Advanced Metering Infrastructure) gateway abstraction.

STS meters need no gateway — units are delivered via a 20-digit token.
AMI meters are networked and receive balance updates directly from this server.

The active gateway is selected by the AMI_GATEWAY setting:
    AMI_GATEWAY=utils.ami_gateway.MockAMIGateway        (default — pilot simulation)
    AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway (real meters)

The mock is isolated in this module. To switch to real ThingsBoard meters:
  1. Set AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway in .env
  2. Add THINGSBOARD_HOST, THINGSBOARD_ACCESS_TOKEN to .env
  3. Implement ThingsBoardAMIGateway.apply_units() and .get_status()
  4. Delete the MockAMIGateway class (or keep for testing)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class MeterStatus:
    """Normalised AMI meter status returned by any gateway."""
    meter_no: str
    is_online: bool
    last_seen: Optional[str] = None       # ISO-8601 timestamp string
    current_balance_kwh: Optional[float] = None
    raw: dict = field(default_factory=dict)


class AMIGatewayBase:
    """
    Abstract base for AMI gateway implementations.
    All credit-increasing operations go through apply_units(); the STS equivalent is
    generating a token — there is intentionally no gateway call for STS meters.
    """

    def apply_units(self, meter, units: Decimal) -> bool:
        """
        Push a balance update to the physical AMI meter.
        Returns True if the meter acknowledged the update, False on failure.
        Implementations must not raise — log errors and return False instead.
        """
        raise NotImplementedError

    def get_status(self, meter) -> Optional[MeterStatus]:
        """
        Return current connectivity/balance status for an AMI meter.
        Returns None if the meter cannot be reached.
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Mock gateway — pilot simulation (SIMULATION ONLY — not for real meters)
# ---------------------------------------------------------------------------

class MockAMIGateway(AMIGatewayBase):
    """
    SIMULATION ONLY. Fakes an AMI meter for pilot testing.
    Logs the update and returns success without any network call.
    Remove or ignore this class when switching to real ThingsBoard meters.
    """

    def apply_units(self, meter, units: Decimal) -> bool:
        logger.info(
            "[MockAMIGateway] SIMULATION: Applied %.4f kWh to AMI meter %s",
            units, meter.meter_no
        )
        return True

    def get_status(self, meter) -> Optional[MeterStatus]:
        from django.utils import timezone
        return MeterStatus(
            meter_no=meter.meter_no,
            is_online=True,
            last_seen=timezone.now().isoformat(),
            current_balance_kwh=float(meter.units),
            raw={'source': 'mock'},
        )


# ---------------------------------------------------------------------------
# ThingsBoard gateway stub — wire in when real meters are available
# ---------------------------------------------------------------------------

class ThingsBoardAMIGateway(AMIGatewayBase):
    """
    STUB — real ThingsBoard AMI gateway.

    Before implementing, ask the developer for:
      - ThingsBoard host (THINGSBOARD_HOST in .env)
      - Device access token per meter (THINGSBOARD_ACCESS_TOKEN or per-meter token)
      - API endpoint for pushing telemetry/attributes

    ThingsBoard REST API reference: https://thingsboard.io/docs/reference/http-api/
    """

    def __init__(self):
        from django.conf import settings
        self.host = getattr(settings, 'THINGSBOARD_HOST', None)
        self.access_token = getattr(settings, 'THINGSBOARD_ACCESS_TOKEN', None)
        if not self.host or not self.access_token:
            logger.warning(
                "ThingsBoardAMIGateway: THINGSBOARD_HOST or THINGSBOARD_ACCESS_TOKEN "
                "not set. Calls will fail until configured."
            )

    def apply_units(self, meter, units: Decimal) -> bool:
        raise NotImplementedError(
            "ThingsBoardAMIGateway.apply_units() is a stub. "
            "Implement with ThingsBoard device API and connection details from the developer."
        )

    def get_status(self, meter) -> Optional[MeterStatus]:
        raise NotImplementedError(
            "ThingsBoardAMIGateway.get_status() is a stub. "
            "Implement with ThingsBoard telemetry API."
        )


# ---------------------------------------------------------------------------
# Gateway factory
# ---------------------------------------------------------------------------

def get_ami_gateway() -> AMIGatewayBase:
    """Return the active AMI gateway based on settings.AMI_GATEWAY."""
    from django.conf import settings
    import importlib

    gateway_path = getattr(settings, 'AMI_GATEWAY', 'utils.ami_gateway.MockAMIGateway')
    module_path, class_name = gateway_path.rsplit('.', 1)
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    return cls()


def apply_units_to_meter(meter, units: Decimal) -> bool:
    """
    Apply credited units to a meter.
    For STS meters: adds to pending_units (a token must be generated separately).
    For AMI meters: calls the AMI gateway and updates meter.units directly on success.
    Returns True on success.
    """
    from django.db import transaction as db_transaction

    if meter.architecture == 'STS':
        with db_transaction.atomic():
            meter.__class__.objects.filter(pk=meter.pk).update(
                pending_units=meter.pending_units + units
            )
            meter.refresh_from_db(fields=['pending_units'])
        logger.info(
            "STS meter %s: added %.4f to pending_units (total pending: %.4f)",
            meter.meter_no, units, meter.pending_units
        )
        return True
    else:
        gateway = get_ami_gateway()
        success = gateway.apply_units(meter, units)
        if success:
            with db_transaction.atomic():
                meter.__class__.objects.filter(pk=meter.pk).update(
                    units=meter.units + units
                )
                meter.refresh_from_db(fields=['units'])
            logger.info(
                "AMI meter %s: applied %.4f kWh via gateway (balance: %.4f)",
                meter.meter_no, units, meter.units
            )
        else:
            logger.error(
                "AMI gateway failed to apply %.4f kWh to meter %s",
                units, meter.meter_no
            )
        return success
