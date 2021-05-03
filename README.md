[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](http://creativecommons.org/licenses/by-nc/4.0/)
[![Tests](https://github.com/scrt/event_masker/actions/workflows/actions.yml/badge.svg)](https://github.com/scrt/event_masker/actions/workflows/actions.yml)
[![GitHub release](https://img.shields.io/github/release/scrt/event_masker.svg)](https://github.com/scrt/event_masker/releases/)

# Event Masker
<p align="center">
<img src="/static/appLogo_2x.png" alt="Event Masker" />
</p>

This App provides filtering logic (whitelisting) for events in Splunk. It has been originally
developped to migrate from Alert Manager Suppression rule (https://github.com/alertmanager/alert_manager) to Splunk Enterprise Security and not losing the whitelisting work that has been done previously, but you can use Event Masker on every dashboard or query in Splunk search bar.

Event Masker consists in multiple components:

1. A custom search command (mask). The command take two arguments :
   * the scope of the mask rule, the scope on the command must match the scope defined in the Event Masker Rules
   * the log argument (true/t or  false/f) that specifies whether to log or not the masking made by the command. It is true by default.
2. A kv store lookup that contains the masking rules
3. A masking rules editor
4. Audit logs to track events that were masked by the command. These logs are pushed daily from the _internal index
   to the _audit index with the help of a scheduled report (mask_command_logs_audit) to benefit from a longer
   retention.
5. Dashboards to audit the masking and check the masking rules

For documentation, see https://github.com/scrt/event_masker

# Configuring Splunk

Install this app into Splunk Searh Head (standalone) by doing the following:

1. Log in to Splunk Web and navigate to "Apps » Manage Apps" via the app dropdown at the top left of Splunk's user
   interface
2. Click the "install app from file" button
3. Upload the file by clicking "Choose file" and selecting the app
4. Click upload

When update this app, please restart Splunk. Some time, you need to refresh Splunk cache (https://<your_splunk_url>/en-US/_bump)

Once the app is installed, you can open "Event Masker" app from the main launcher. You need to create at least 1 rule to use it.

Once the masking rule has been created, just add the following command at the very end of the Splunk Savedsearch/Correlation search. Transforming command must be used at the left of this command.

```spl
index=<index> | table <field1>, <field2> | mask scope=<the_scope_of_the_created_masking_rule>
```

The search will be launched and if everything is correct, the events that were to be masking should not appear in the set of results.

To check that the masking rule and the search have been correctly implemented, go to the Event Masker Logs
dashboard. 

# Usage information

By default, you need to be Splunk Admin to see Event Masker. If you change that, only admin could change rules or conditions settings.

In Event Masker Rules list (default page):
* Add rule need at least title and scope
* You can edit rule properties with "Edit properties" action
* Renaming a rule has no impact in mask command
* To use mutilple rule as the same time, you can use the same scope as another rule and use it in mask command
* AND rule need at least 2 conditions
* To edit conditions, click on title field
* "Start Date" and "End date" are the validity period for a rule. If you not set these fields, your rule will be valid all the time. This functionality will be improved in the next release.
* Import file must have the following JSON format :

```json
   [
    {
      "title": "rule1",
      "description": "description1",
      "type": "normal",
      "match_type": "any",
      "scope": "scope1",
      "comment": "comment1",
      "startDate": "2021-04-01T16:00",
      "endDate": "2021-07-14T15:59",
      "modificationDate": "2021-04-30T15:57",
      "modificationUser": "admin",
      "creationDate": "2021-04-30T15:56",
      "disabled": false,
      "creationUser": "admin",
      "conditions": [
        {
          "field": "condition1",
          "operator": "is",
          "value": "value1",
          "iscasesensitive": true
        }
      ]
    },
    {
      "title": "rule2",
      "description": "description2",
      "type": "normal",
      "match_type": "all",
      "scope": "scope2",
      "comment": "comment2",
      "startDate": "",
      "endDate": "",
      "modificationDate": "2021-04-30T15:58",
      "modificationUser": "admin",
      "creationDate": "2021-04-30T15:58",
      "disabled": false,
      "creationUser": "admin",
      "conditions": [
        {
          "field": "condition2",
          "operator": "ends with",
          "value": "value2",
          "iscasesensitive": false
        },
        {
          "field": "condition2",
          "operator": "starts with",
          "value": "value2",
          "iscasesensitive": false
        }
      ]
    }
  ]
```

Do not forget that fields title, scope and match_type are mandatory

In Event Masker rule editor (edit conditions):
* Right click on the table displays a context menu that enables you to add/delete a row or copy/paste data. You can also save as CSV the table and order data by headers.
* Values can be copied from splunk search result and pasted in the table bellow. This add row automatically.
* Use "fieldname" (without quotes) to refer to a field from results
* By default, values are case in-sensitive
* Use matches operator for regex. Ensure that iscasensitive is set to true, otherwise your pattern will be lowercased which may cause the match to fail
* Use _time to filter on specific range time

Do not forget : All of the conditions must be true for a valid application. Make sure it works by testing your rules (for example : search * | table myfield | mask scope="rule scope")

# Known Limitations

* Splunk multi-value (MV) field are supported by Event Masker but at this time, masking rule hide the whole line when conditions are matched.

* Search Head Cluster have not been tested.

* It is possible that importing and exporting takes time and freeze the browser. This will be patched in a future version but for now, take the opportunity to have a coffee :coffee:


# Getting Support

Go to the following website if you need support:

     http://answers.splunk.com/

You can access to the source-code and get technical details about the app at:

     https://github.com/scrt/event_masker/


Feel free to create issues and/or pull requests on the repo !

# Credits

Many thanks to:

* Mika Borner (https://github.com/my2ndhead) and Simon Balz (https://github.com/simcen) for Alert
  Manager (https://github.com/alertmanager/alert_manager). Event Masker app is inspired by Alert Manager suppression rule engine.
  
# External Lib

This project use external lib under MIT Licence to works :
* Datables and Select extension
* Jexcel
* Jsuites
* Text.js

Thanks to the developers of these libs.

# Licence

This project is protected by [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.en).
