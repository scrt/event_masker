from typing import Dict, List

from bin.lib.compare_value import apply_rule
from bin.lib.mask_rule import MaskRule

'''
Function used to check if a record should be masked based on whitelisting rules.
'''


def _should_inner(
        record: Dict,
        rule: MaskRule
) -> bool:
    """
    >>> rule1 = {'field': 'toto', 'operator': '<', 'value': '0.0', 'iscasesensitive': 'True'}
    >>> some_rule_raw = {'match_type': 'any', 'conditions': [rule1]}
    >>> some_rule = MaskRule.from_dict(some_rule_raw)
    >>> _should_inner({'toto': 0.0, 'iscasesensitive': 'True'}, some_rule) # Should not mask record if there is no rule
    False
    """

    should_result: List[bool] = []

    for condition in rule.conditions:

        if condition.field in record:
            if not condition.iscasesensitive:
                left_value = record[condition.field]
                operator = condition.operator
                right_value = condition.value
                
                # Handle multi value fields
                if type(record[condition.field]) is list :
                    rule_applied_result = False
                    for mv_value in record[condition.field] :
                        rule_applied_result =  rule_applied_result or apply_rule(
                            left_value= mv_value.casefold(),
                            operator=condition.operator,
                            right_value=right_value.casefold()
                        )
                else:
                    rule_applied_result = apply_rule(
                        left_value=left_value.casefold(),
                        operator=operator,
                        right_value=right_value.casefold()
                    )
                
            else:
                # Handle multi value fields
                if type(record[condition.field]) is list :
                    rule_applied_result = False
                    for mv_value in record[condition.field] :
                        rule_applied_result =  rule_applied_result or apply_rule(
                            left_value= mv_value,
                            operator=condition.operator,
                            right_value=condition.value
                        )
 
                else:
                    rule_applied_result = apply_rule(
                        left_value=record[condition.field],
                        operator=condition.operator,
                        right_value=condition.value
                    )
            
            should_result.append(rule_applied_result)

    if rule.match_type == "any":
        return any(should_result)
    else:  
        return all(should_result)


'''
This function call _should_inner on each record and rule to check if they match.
'''


def should_mask(
        record: Dict,
        rules: List[MaskRule]
) -> bool:
    """
    >>> should_mask({}, []) # Should not mask record if there is no rule
    False
    """

    for rule in rules:
        if _should_inner(record, rule):
            return True

    return False
