#!/usr/bin/env python3

from __future__ import absolute_import, division, print_function, unicode_literals
from inspect import _empty

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

import logging, logging.handlers
import splunk


def setup_logging(logging_level: int):
    logger = logging.getLogger('event_masker_command.log')
    logger.setLevel(logging_level)
    splunk_home = os.environ['SPLUNK_HOME']

    logging_file_name = "event_masker.log"
    base_log_path = os.path.join('var', 'log', 'splunk')
    logging_format = "%(asctime)s %(levelname)s %(message)s"
    splunk_log_handler = logging.handlers.RotatingFileHandler(
        os.path.join(splunk_home, base_log_path, logging_file_name),
        mode='a',
        maxBytes=25000000,
        backupCount=5
    )
    splunk_log_handler.setFormatter(logging.Formatter(logging_format))
    logger.addHandler(splunk_log_handler)

    logging_default_config_file = os.path.join(splunk_home, 'etc', 'log.cfg')
    logging_local_config_file = os.path.join(splunk_home, 'etc', 'log-local.cfg')
    logging_stanza_name = 'python'
    splunk.setupSplunkLogger(logger, logging_default_config_file, logging_local_config_file, logging_stanza_name)
    return logger


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
        Syntax: scope=<scope>
        Description: Scope of the rule to be applied
        Example:
        index=winevents EventCode=4624
        | mask scope="logins_system"
        ''',
        require=True
    )

    log = Option(
        doc='''
        Syntax: log=<t_or_f>
        Description: Logs in the internal logs
        Example:
        index=winevents EventCode=4624
        | mask scope="logins_system" log=t
        ''',
        require=False,
        default=True,
        validate=validators.Boolean()
    )

    timefield = Option(
        doc='''
        Syntax: timefield=<timefield_name>
        Description: Select the time field with the format : %Y-%m-%d %H:%M:%S.%f
        Example:
        index=winevents EventCode=4624
        | mask scope="logins_system" log=t fieldname="timestamp"
        ''',
        require=False
    )

    def stream(
            self,
            records: Iterable[Dict]
    ) -> Iterable[Dict]:
        
        scope = self.scope
        log = self.log
        timefield = self.timefield
        kvstore = self.service.kvstore
        rules_kv = kvstore['event_masker_rules']
        rules = rules_kv.data.query()

        rules_raw, rules_raw_disabled = extract_rules_from_scope(rules, scope)

        if rules_raw_disabled:
            for rule in rules_raw_disabled:
                logger.warning(f'log_level="WARNING" component=EventMasker - scope="{scope}" rule="{rule}" event_message="rule not enable"')

        if (not rules_raw) & (len(rules_raw_disabled) != 0):
            logger.warning(f'log_level="WARNING" component=EventMasker - scope="{scope}" event_message="scope match but rule is not enable"')
       
        if (not rules_raw) & (not rules_raw_disabled):
            logger.error(f'log_level="ERROR" component=EventMasker - scope="{scope}" event_message="scope not match"')

        if rules_raw:
            conditions = [MaskRule.from_dict(c) for c in rules_raw]

            match = False
            match_once = False
            event_message = ""
            error_messages = []
            count = 0
            
            for record in records:
                try:
                    should_mask_record, rule, event_message, error_messages = should_mask(record, conditions, timefield)
                    if error_messages:
                        if log:
                            for error in error_messages:
                                logger.warning(f'log_level="WARNING" component=EventMasker - scope="{scope}" rule="{error[0]}" event_message="{error[1]}" record="{error[2]}"')
                    if should_mask_record:
                        match_once = True
                        if log:
                            logger.info(f'log_level="INFO" component=EventMasker - scope="{scope}" rule="{rule}" event_message="{event_message}" record="{record}"')                          
                    else:
                        match = False
                        yield record
                except BaseException as err:
                    match = False
                    logger.error(f'log_level="ERROR" component="EventMasker" - scope="{scope}" event_message="{err}"')
                    yield record
            if not error_messages and not match and not match_once and event_message:
                if count == 0 :
                    logger.warning(f'log_level="WARNING" component=EventMasker - scope="{scope}" rule="{rule}" event_message="{event_message}" record="{conditions}"')
                    count = 1
        else:
            for record in records:
                yield record
        
if __name__ == '__main__':
    logger = setup_logging(logging.DEBUG)
    dispatch(MaskCommand, sys.argv, sys.stdin, sys.stdout, __name__)
