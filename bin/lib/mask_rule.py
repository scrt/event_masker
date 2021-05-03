from dataclasses import dataclass
from typing import Dict, List

from bin.lib.condition import Condition

'''
This class is used to represent a whitelisting rule based on Condition objects. 
The rule can have two different match types : OR (match at least one condition) or AND (match all conditions).
'''


@dataclass(init=False)
class MaskRule:
    match_type: str
    conditions: List[Condition]

    def __init__(
            self,
            match_type: str,
            conditions: List[Condition],
    ):
        match_type = match_type.lower()
        assert match_type in ('any', 'all'), f'Unrecognized match_type: {match_type}'
        self.match_type = match_type

        self.conditions = conditions

    @staticmethod
    def from_dict(rules_raw: Dict) -> 'Condition':
        """
        >>> sr = MaskRule.from_dict({'match_type': 'ANY', 'conditions':[]}) # Dummy test: should not throw
        >>> sr.match_type
        'any'
        """
        return MaskRule(
            rules_raw.get('match_type'),
            [Condition.from_dict(r) for r in rules_raw.get('conditions')]
        )
