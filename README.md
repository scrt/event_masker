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

1. A custom search command (mask). The command take three arguments :
   * the scope of the mask rule, the scope on the command must match the scope defined in the Event Masker Rules
   * the log argument (true/t or  false/f) that specifies whether to log or not the masking made by the command. It is true by default.
   * the timefield argument used only when you set a startDate and endDate to mask events on a specific timerange.
2. A kv store lookup that contains the masking rules
3. A masking rules editor
4. Audit logs to track events that were masked by the command. These logs are pushed daily from the _internal index
   to the _audit index with the help of a scheduled report (mask_command_logs_audit) to benefit from a longer
   retention.
5. Dashboards to audit the masking and check the masking rules
6. A workflow action from Enterprise Security to facilitate whitelisting from a notable. It will extract fields from the notable raw in order to fill Event Masker form. 

For documentation, see https://github.com/scrt/event_masker

We also published articles about Event Masker and its features on our blog, see https://blog.scrt.ch/category/analytics-2/


# Configuring Splunk

Install this app into Splunk Searh Head (standalone) by doing the following:

1. Log in to Splunk Web and navigate to "Apps » Manage Apps" via the app dropdown at the top left of Splunk's user
   interface
2. Click the "install app from file" button
3. Upload the file by clicking "Choose file" and selecting the app
4. Click upload

When update this app, please restart Splunk. Some time, you need to refresh Splunk cache (https://<your_splunk_url>/en-US/_bump)


# Command usage

Once the app is installed, you can open "Event Masker" app from the main launcher. You need to create at least 1 rule to use it.

Once the masking rule has been created, just add the following command at the very end of the Splunk Savedsearch/Correlation search. Transforming command must be used at the left of this command.

```spl
index=<index> | table <field1>, <field2> | mask scope=<the_scope_of_the_created_masking_rule>
```

If you have set startDate and endDate fields, you must set timefield option. You should write the name of your time field with the format %Y-%m-%d %H:%M:%S.%f.

Example :

```spl
index=<index> | table <field1>, <field2>, _time_ | eval _time=strftime(_time,"%Y-%m-%d %H:%M:%S.%f") |mask scope=<the_scope_of_the_created_masking_rule> timefield="_time"
```

The search will be launched and if everything is correct, the events that were to be masking should not appear in the set of results. 

To check that the masking rule and the search have been correctly implemented, go to the Event Masker Logs
dashboard. 

You have to know : If conditions, validity perriod or error occurs, Event Masker return splunk search without modification.

# Usage information

By default, you need to be Splunk Admin (`admin` group) or Enterprise Security Admin (`ess_admin` group) to see Event Masker and make modifications on rules. To give read-only capabilities to a specific user, you have to add it in Enterprise Security Analyst or User groups (`ess_analyst` or `ess_user`). 
To ensure that application logging works as expected, the groups mentioned previously (`admin` and `ess_admin`) needs to have the right to write in _\_internal_ index. This capability will provide logs regarding modifications made by users on Event Masker rules. 

In Event Masker Rules list (default page):
* Add rule need at least title and scope
* Renaming a rule has no impact in mask command
* To use multiple rule as the same time, you can use the same scope as another rule and use it in mask command
* AND rule need at least 2 conditions
* To edit a rule, click on title field
* "Start Date" and "End date" are available to filter your events with a specific timerange. You must use timefield option to do that. If you not set these fields, your rule will mask events all the time. 
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
          "iscasesensitive": true,
          "comment": "My comment on my condition"
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
          "iscasesensitive": false,
          "comment": "My comment on my condition"
        },
        {
          "field": "condition2",
          "operator": "starts with",
          "value": "value2",
          "iscasesensitive": false,
          "comment": "My comment on my condition"
        }
      ]
    }
  ]
```

Do not forget that fields title, scope and match_type are mandatory (and conditions, of course)

In Event Masker rule editor (edit conditions):
* Right click on the table displays a context menu that enables you to add/delete a row or copy/paste data. You can also save as CSV the table and order data by headers.
* Values can be copied from splunk search result and pasted in the table bellow. This add row automatically.
* Use "fieldname" (without quotes) to refer to a field from results
* By default, values are case insensitive

Do not forget : All of the conditions must be true for a valid application. Make sure it works by testing your rules (for example : search * | table myfield | mask scope="rule scope")

# Known Limitations

* Splunk multi-value (MV) field are supported by Event Masker but at this time, masking rule hide the whole line when conditions are matched.

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
* DataTables and Select/Buttons extensions
* Jexcel (Jspreadsheet CE)
* Jsuites
* Text.js

Thanks to the developers of these libs.

# Licence

This project is protected by [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.en).
