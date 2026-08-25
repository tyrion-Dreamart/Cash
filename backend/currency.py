DEFAULT_FX_RATE = 17.5

# Fixed rates vs USD for currencies that don't float with the MXN fx_rate input
_FIXED_RATES = {"CRC": 600, "JMD": 155, "XCD": 2.7}


def to_usd(amount, currency, fx_rate: float = DEFAULT_FX_RATE) -> float:
    """Convert an amount in `currency` to USD.

    Single source of truth for currency conversion — every router/service
    should import this instead of defining its own copy (previously some
    copies only knew about USD/MXN and silently mis-converted CRC/JMD/XCD).
    """
    amount = float(amount)
    cur = str(currency).replace("Currency.", "")
    if cur == "USD":
        return amount
    if cur == "MXN":
        return amount / fx_rate
    if cur in _FIXED_RATES:
        return amount / _FIXED_RATES[cur]
    return amount / fx_rate
