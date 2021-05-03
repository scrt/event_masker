from dataclasses import dataclass
from typing import Dict

'''
This class is used to represent a condition in a rule. Such as : process_name (field) is (operator) explorer.exe (value)
This example will whitelist the process explorer.exe. It can be case sensitive (iscasesensitive).
'''


@dataclass(init=False)
class Condition:
    field: str
    operator: str
    value: str
    iscasesensitive: bool

    def __init__(
            self,
            field: str,
            operator: str,
            value: str,
            iscasesensitive: bool
    ):
        assert field is not None and len(field) > 0, f'condition.field is invalid: {field}'

        if field.startswith("$"):
            condition_field_start = '$result.'
            condition_field_cleaned = field[len(condition_field_start):-1]
            self.field = condition_field_cleaned
        else:
            self.field = field

        assert operator is not None and len(operator) > 0, f'condition.operator is invalid: {operator}'
        self.operator = operator

        assert value is not None and len(value) > 0, f'condition.value is invalid: {value}'
        self.value = value

        assert iscasesensitive is not None, f'condition.iscasesensitive is invalid: {iscasesensitive}'
        self.iscasesensitive = iscasesensitive

    @staticmethod
    def from_dict(condition_raw: Dict) -> 'Condition':
        """
        >>> r = Condition.from_dict({'field': '$result.fqdn$', 'operator': '>', 'value': '2.0', 'iscasesensitive': 'True'}) # Dummy test: should not throw
        >>> r.field
        'fqdn'
        """
        return Condition(condition_raw.get('field'), condition_raw.get('operator'), condition_raw.get('value'),
                         condition_raw.get('iscasesensitive'))
