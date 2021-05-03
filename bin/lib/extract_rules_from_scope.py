from typing import List, Dict

'''
Extract rules based on a specific scope 
'''


def extract_rules_from_scope(
        all_rules: List[Dict],
        scope: str
) -> List[Dict]:
    """
    >>> all_rules_l = [\
        {'name': 'rule1', 'disabled': True, 'scope': 'firstscope'},\
        {'name': 'rule2', 'disabled': False, 'scope': 'secondscope'},\
        {'name': 'rule3', 'disabled': False, 'scope': 'thirdscope'}\
        ]
    >>> rules_in_scope, disabled_rules_in_scope = extract_rules_from_scope(all_rules_l, 'thirdscope')
    >>> assert len(rules_in_scope) == 1, rules_in_scope
    >>> assert rules_in_scope[0]['name'] == 'rule3', rules_in_scope[0]
    """
    matching_rules = []
    matching_rules_disabled = []

    for rule in all_rules:
        if rule['scope'] == scope:
            if not rule['disabled']:
                matching_rules.append(rule)
            else:
                matching_rules_disabled.append(rule['title'])

    return matching_rules, matching_rules_disabled
