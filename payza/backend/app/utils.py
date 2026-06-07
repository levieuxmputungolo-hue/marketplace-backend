import random
import uuid

from app.settings import CARD_BIN, CARD_LENGTH


def luhn_checksum(card_number: str) -> int:
    def digits_of(n):
        return [int(d) for d in str(n)]

    digits = digits_of(card_number)
    odd_digits = digits[-1::-2]
    even_digits = digits[-2::-2]
    total = sum(odd_digits)
    for d in even_digits:
        total += sum(digits_of(d * 2))
    return total % 10


def generate_card_number() -> str:
    remaining_length = CARD_LENGTH - len(CARD_BIN) - 1
    partial = CARD_BIN + "".join(str(random.randint(0, 9)) for _ in range(remaining_length))
    check_digit = (10 - luhn_checksum(partial + "0")) % 10
    return partial + str(check_digit)


def generate_cvv() -> str:
    return str(random.randint(100, 999))


def generate_expiry() -> str:
    from datetime import datetime
    future = datetime(datetime.utcnow().year + 3, datetime.utcnow().month, 1)
    return future.strftime("%m/%y")


def generate_reference() -> str:
    return "TXN" + uuid.uuid4().hex[:12].upper()
