"""Common utility functions for BGP backends"""


def format_uptime(seconds: int) -> str:
    """
    Format uptime in seconds to a human-readable string.

    Args:
        seconds: Uptime in seconds

    Returns:
        Formatted string like "2d 3h 45m" or "00:02:06"
    """
    if seconds == 0:
        return "00:00:00"

    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"
