#!/usr/bin/env python3

from __future__ import absolute_import, division, print_function, unicode_literals

import os
import sys
from typing import Dict, Iterable

import splunk.appserver.mrsparkle.lib.util as util

dir = os.path.join(util.get_apps_dir(), 'event_masker')
if dir not in sys.path:
    sys.path.append(dir)

from bin.lib.extract_rules_from_scope import extract_rules_from_scope
from bin.lib.should_mask import should_mask
from bin.lib.mask_rule import MaskRule

from splunklib.searchcommands import dispatch, StreamingCommand, Configuration, Option, validators

import logging, logging.handlers, datetime
import splunk


def setup_logging(logging_level: int):
    logger = logging.getLogger('event_masker_command.log')
    logger.setLevel(logging_level)
    splunk_home = os.environ['SPLUNK_HOME']

    logging_file_name = "event_masker.log"
    base_log_path = os.path.join('var', 'log', 'splunk')
    logging_format = "%(asctime)s %(levelname)-s\t%(module)s:%(lineno)d - %(message)s"
    splunk_log_handler = logging.handlers.RotatingFileHandler(
        os.path.join(splunk_home, base_log_path, logging_file_name),
        mode='a'
    )
    splunk_log_handler.setFormatter(logging.Formatter(logging_format))
    logger.addHandler(splunk_log_handler)

    logging_default_config_file = os.path.join(splunk_home, 'etc', 'log.cfg')
    logging_local_config_file = os.path.join(splunk_home, 'etc', 'log-local.cfg')
    logging_stanza_name = 'python'
    splunk.setupSplunkLogger(logger, logging_default_config_file, logging_local_config_file, logging_stanza_name)
    return logger


# Check the validity period
def is_valid(rule):
    is_valid = False

    # Get current time
    current_time = int(datetime.datetime.now().timestamp())

    # Extract start and end valid period
    start_period = rule[0]["startDate"]
    if not start_period:
        start_period = current_time  # If the start date is not set
    else:
        try:
            start_period = int(datetime.datetime.strptime(start_period, "%Y-%m-%dT%H:%M").timestamp())
        except ValueError:
            logger.warning(f'masked record: scope="{rule[0]["scope"]}" result="startDate {start_period} not match format %Y-%m-%dT%H:%M"')
            return is_valid

    end_period = rule[0]["endDate"]
    if not end_period:
        end_period = current_time + 631065600  # If the end date is not set (default 20 years)
    else:
        try:
            end_period = int(datetime.datetime.strptime(end_period, "%Y-%m-%dT%H:%M").timestamp())
        except ValueError:
            logger.warning(f'masked record: scope="{rule[0]["scope"]}" result="endDate {end_period} not match format %Y-%m-%dT%H:%M"')
            return is_valid
            

    # Check that the current time is between start and end valid period
    if (current_time >= start_period) and (current_time <= end_period):
        is_valid = True

    logger.debug(
        f'Date timestamps; current time: {current_time}, start validity period: {start_period}, end validity period: {end_period}')

    return is_valid


@Configuration()
class MaskCommand(StreamingCommand):
    """ 
    Masks records from the results according to pre-existing rules.
    ##Syntax
    .. code-block::
        <your_search>
        | mask scope="<your_scope>" the scope defined in the rules editor
    ##Description
    Masks records according to the rules defined in the rules lookup and the scope of the search.
    ##Example
    Mask login events from a specific user defined in rules.
    The record won't appear in the results and thus won't trigger an alert.
    .. code-block::
        index=winevents EventCode=4624
        | mask scope="logins_system"

    """

    scope = Option(
        doc='''
        **Syntax:** **scope**=***<scope>*
        **Description:** Scope of the rule to be applied*
        **Example:**
        index=winevents EventCode=4624
        | mask scope="logins_system"
        ''',
        require=True
    )

    log = Option(
        doc='''
        **Syntax:** **log**=***t*
        **Description:** Logs in the internal logs*
        **Example:**
        index=winevents EventCode=4624
        | mask log=t scope="logins_system"
        ''',
        require=False,
        default=True,
        validate=validators.Boolean()
    )

    def stream(
            self,
            records: Iterable[Dict]
    ) -> Iterable[Dict]:
        
        scope = self.scope
        log = self.log
        
        logger.debug(f'In MaskCommand: scope={self.scope} log={self.log}')

        kvstore = self.service.kvstore
        rules_kv = kvstore['event_masker_rules']
        rules = rules_kv.data.query()

        rules_raw, rules_raw_disabled = extract_rules_from_scope(rules, scope)

        if rules_raw_disabled:
            for rule in rules_raw_disabled:
                logger.warning(f'masked record: scope="{scope}" result="rule \"{rule}\" not enable"')

        if (not rules_raw) & (len(rules_raw_disabled) != 0):
            logger.warning(f'masked record: scope="{scope}" result="scope match but rule is not enable"')
       
        if (not rules_raw) & (not rules_raw_disabled):
            logger.warning(f'masked record: scope="{scope}" result="scope not match"')

        if rules_raw:
 
            rules = [MaskRule.from_dict(r) for r in rules_raw]

            if not is_valid(rules_raw):
                logger.warning(f'masked record: scope="{scope}" result="validity period not match"')
                
                for record in records:
                    yield record
            else :

                match = False

                for record in records:

                    should_mask_record = should_mask(record, rules)

                    if not should_mask_record:
                        yield record
                    elif log:
                        logger.info(f'masked record: scope="{scope}" result="values match"')
                        match = True
                    else:
                        match = True
                    
                if not match:
                    logger.warning(f'masked record: scope="{scope}" result="values not match"')
        else:
            for record in records:
                yield record
        

if __name__ == '__main__':
    logger = setup_logging(logging.INFO)
    dispatch(MaskCommand, sys.argv, sys.stdin, sys.stdout, __name__)
