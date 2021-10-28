from typing import Dict, List

from bin.lib.compare_value import apply_rule
from bin.lib.mask_rule import MaskRule

import datetime

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
                        result = apply_rule(
                            left_value= mv_value.casefold(),
                            operator=condition.operator,
                            right_value=right_value.casefold()
                        )
                        if(result is None):
                            return None
                        rule_applied_result =  rule_applied_result or result
                else:
                    result = apply_rule(
                        left_value=left_value.casefold(),
                        operator=operator,
                        right_value=right_value.casefold()
                    )
                    if(result is None):
                        return None
                    rule_applied_result = result 
            else:
                # Handle multi value fields
                if type(record[condition.field]) is list :
                    rule_applied_result = False
                    for mv_value in record[condition.field] :
                        result = apply_rule(
                            left_value=mv_value,
                            operator=condition.operator,
                            right_value=condition.value
                        )
                        if(result is None):
                            return None
                        rule_applied_result =  rule_applied_result or result
                else:
                    result = apply_rule(
                        left_value=record[condition.field],
                        operator=condition.operator,
                        right_value=condition.value
                    )
                    if(result is None):
                        return None
                    rule_applied_result = result
            
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
        rules: List[MaskRule],
        timefield: str
) -> bool:

  
    error_messages = []
    title = ""
    event_message = ""

    for rule in list(rules):
        if rule:
            if not rule.startDate and not rule.endDate:
                result = _should_inner(record, rule)
                if result:
                    event_message = "conditions match"
                    return True, rule.title, event_message, error_messages
                elif result is None:
                    event_message = "regex malformed"
                    error_messages.append([rule.title, event_message, rule.conditions])
                    rules.remove(rule)
                else:
                    title = rule.title
                    event_message = "conditions not match"
            else:
                if not timefield:
                    event_message = "timefield should be defined"
                    error_messages.append([rule.title, event_message, rule.conditions])
                    rules.remove(rule)
                elif timefield not in record:
                    event_message = "timefield not in records"
                    error_messages.append([rule.title, event_message, rule.conditions])
                    rules.remove(rule)
                else :
                    try:
                        event_time = int(datetime.datetime.strptime(str(record[timefield]), '%Y-%m-%d %H:%M:%S.%f').timestamp())
                    except Exception:
                        event_message = "timefield not match format or not in records"
                        error_messages.append([rule.title, event_message, rule.conditions])
                        rules.remove(rule)

                    if not rule.startDate:
                        start_period = 0  # If the start date is not set
                    else:   
                        try:
                            start_period = int(datetime.datetime.strptime(rule.startDate, "%Y-%m-%dT%H:%M").timestamp())
                        except Exception:
                            event_message = "startDate not respect format"
                            error_messages.append([rule.title, event_message, rule.startDate])
                            rules.remove(rule)

                    if not rule.endDate:
                        current_time = int(datetime.datetime.now().timestamp())
                        end_period = current_time + 631065600 
                    else:
                        try:
                            end_period = int(datetime.datetime.strptime(rule.endDate, "%Y-%m-%dT%H:%M").timestamp())
                        except Exception:
                            event_message = "endDate not respect format"
                            error_messages.append([rule.title, event_message, rule.endDate])
                            rules.remove(rule)
                            
                    if (event_time >= start_period) and (event_time <= end_period):
                        result = _should_inner(record, rule)
                        if result:
                            event_message = "validity period match"
                            return True, rule.title, event_message, error_messages
                        elif result is None:
                            event_message = "regex malformed"
                            error_messages.append([rule.title, event_message, rule.conditions])
                            rules.remove(rule)
                        else:
                            title = rule.title
                            event_message = "Validity period not match"
                    else:
                        title = rule.title
                        event_message = "Validity period is outside of records timerange"
    
    return False, title, event_message, error_messages