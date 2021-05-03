import re


def apply_rule(
        left_value: str,
        operator: str,
        right_value: str
) -> bool:
    """
    >>> apply_rule('2.0', '>', '1.5')
    True
    >>> apply_rule('1.0', '>', '1.5')
    False
    >>> apply_rule('1.0', '<', '1.5')
    True
    >>> apply_rule('2.0', '<', '1.5')
    False
    """

    if operator == '>':
        return float(left_value) > float(right_value)
    elif operator == '<':
        return float(left_value) < float(right_value)
    elif operator in ('=', '==', 'is'):
        return str(left_value) == str(right_value)
    elif operator in ('!=', 'is not'):
        return str(left_value) != str(right_value)
    elif operator == '<=':
        return float(left_value) <= float(right_value)
    elif operator == '>=':
        return float(left_value) >= float(right_value)
    elif operator == 'contains':
        return right_value in left_value
    elif operator == 'does not contain':
        return right_value not in left_value
    elif operator == 'starts with':
        return left_value.startswith(right_value)
    elif operator == 'ends with':
        return left_value.endswith(right_value)
    elif operator == "matches":
        return bool(re.search(right_value, left_value))
    elif operator == "does not match":
        return not bool(re.search(right_value, left_value))

    raise AssertionError(f'Comparator "{operator}" was not recognized.')
