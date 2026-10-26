"""One local integration; no external accounts or credentials."""

from homeassistant import config_entries
from .const import DOMAIN


class RoomsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up the local model library."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Confirm the local library setup."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="3D Rooms", data={})
        return self.async_show_form(step_id="user")
