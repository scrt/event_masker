require.config({
    paths: {
        jexcel: "../app/event_masker/contrib/jexcel/jexcel",
        jsuites: "../app/event_masker/contrib/jsuites/jsuites",
        text: "../app/event_masker/contrib/text",
    },
    shim: {
        jexcel: {
            deps: ["jquery", "jsuites"],
        }
    }
});

define(['underscore', 
    'splunkjs/mvc', 
    'jquery', 
    'splunkjs/mvc/simplesplunkview', 
    'text!../app/event_masker/templates/EventMaskerForm.html', 
    "css!../app/event_masker/EventMaskerForm.css", 
    'jexcel', 
    'jsuites',  
    "css!../app/event_masker/contrib/jexcel/jexcel.css", 
    "css!../app/event_masker/contrib/jsuites/jsuites.css"],

    function (_, mvc, $, SimpleSplunkView, EventMaskerFormTemplate) {

        // Get current user
        var currentUser=Splunk.util.getConfigValue("USERNAME");

        var tmpJson = {};
        var jsonReady = false;

        var conditionLogs = [];
        var action = "";

        // Define the custom view class
        var EventMaskerFormView = SimpleSplunkView.extend({
            className: "EventMaskerFormView",

            defaults: {
                'collection_owner': 'nobody',
                'list_link': null,
                'list_link_title': "Back to list"
            },

            events: {
                "click #save": "saveRule",
                "click #cancel": "gotoToList"
            },

            initialize: function () {

                // Apply the defaults
                this.options = _.extend({}, this.defaults, this.options);

                this.list_link = this.options.list_link;
                this.list_link_title = this.options.list_link_title;

                this.lister = this.options.lister;

                this.collection_owner = this.options.collection_owner;
                this.app = this.options.app;
                this.collection = this.options.collection;

                this.rule = null;
                this.jexcel = null;
            },

            /**
             * Get date and time for logs
            */
             getDateTime: function(){

                // Get datetime
                var today = new Date();
                var month = today.getMonth()+1
                if (month < 10){
                    month = "0" + month;
                }
                var day = today.getDate();
                if (day < 10){
                    day = "0" + day;
                }
                var minutes = today.getMinutes();
                if (minutes < 10){
                    minutes = "0" + minutes;
                }
                var hours = today.getHours()
                if (hours < 10){
                    hours = "0" + hours;
                }
                var date = today.getFullYear()+'-'+ month +'-'+ day;
                var time = hours + ":" + minutes;
                var dateTime = date+'T'+time;

                return dateTime;
                
            },

            /**
             * Search event_masker_rules_type_lookup to populate rule_type dropdown in EventMaskerForm
            */
            getSelectOption: function(rule){
                var uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/event_masker/search/jobs");
                var sid = "";
                jQuery.ajax({
                    url: uri,
                    type: 'POST',
                    async: false,
                    data : {
                        search: '|inputlookup event_masker_rules_type_lookup'
                    },
                    success: function (results) {
                        sid = $(results).find("sid").text()
                    }.bind(this)
                });

                var uri_response = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/event_masker/search/jobs/"+sid+"/results?output_mode=json");
              
                this.sleep(500)
               
                jQuery.ajax({
                    url: uri_response,
                    type: 'get',
                    async: true,
                    success: function (results) {
                        
                        res = results["results"]
                        
                        $select = $('#rule-type');

                        for(i = 0; i < res.length; ++i){
                            $select.append('<option value="' + res[i]["value"] + '">' + res[i]["rule_type"] + '</option>"');                        
                        }

                        if(typeof rule !== 'undefined') {
                            this.populateFormWithManagedLookup(rule);
                        }                      
                    
                    }.bind(this)
                });
            },
            /**
             * Write into Splunk index _internal
             * @param {*} data event message which will be written in index
            */
            doWriteToIndex: function(data){

                var uri = Splunk.util.make_url("/splunkd/__raw/services/receivers/simple?source=EventMaskerFormView&index=_internal&sourcetype=event_masker-rule_logs");

                jQuery.ajax({
                    url: uri,
                    type: 'POST',
                    async: false,
                    contentType: "application/json;charset=utf-8",
                    data: data,
                    success: function () {
                        
                    }.bind(this)
                });

            },

            /**Check if user has capability */
            hasCapability: function (capability) {

                var uri = Splunk.util.make_url("/splunkd/__raw/services/authentication/current-context?output_mode=json");

                if (this.capabilities === null) {

                    // Fire off the request
                    jQuery.ajax({
                        url: uri,
                        type: 'GET',
                        async: false,
                        success: function (result) {

                            if (result !== undefined) {
                                this.capabilities = result.entry[0].content.capabilities;
                            }

                        }.bind(this)
                    });
                }

                return $.inArray(capability, this.capabilities) >= 0;

            },

            /**
             * Extract GET Parameter from URI
             * @param {*} parameterName Parameter name to extract
             * @returns the parameter value
             */
            getParameterByName: function (parameterName) {
                var result = null,
                tmp = [];
                location.search.substr(1).split("&").forEach(function (item) {
                    tmp = item.split("=");
                    if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
                });
            return result;
            },

            /**
             * Custom blocking sleep command
             * @param {*} milliseconds number of milliseconds to wait
             */
            sleep: function (milliseconds) {
                const date = Date.now();
                let currentDate = null;
                do {
                  currentDate = Date.now();
                } while (currentDate - date < milliseconds);
            },
            
            /**
             * Search and return raw notable based on hash_id, and targeted on timestamp
             * @param {*} key notable hash_id
             * @param {*} time notable timestamp
             * @returns A JSON with fields parsed from the _raw
             */
            getNotable: function (key, time) {
                var earliest = Math.floor(time / 100) * 100;
                var latest = Math.ceil(time/100)*100;
                // Fields we don't want to extract from the raw
                const excludedFields = ["fidelity", "firstTime", "info_max_time", "info_min_time", "info_search_time", "lastTime", "mitre_id", "process_id", "risk_score", "tactics", "technique", "url" ];
                var uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/event_masker/search/jobs");
                var sid = "";
                jQuery.ajax({
                    url: uri,
                    type: 'POST',
                    async: false,
                    data : {
                        search: 'search earliest=' + earliest + ' latest=' + latest + ' index=notable | eval event_hash=md5(_time._raw) | search event_hash='+key
                    },
                    success: function (results) {
                        sid = $(results).find("sid").text()
                    }.bind(this)
                });

                var uri_response = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/event_masker/search/jobs/"+sid+"/results?output_mode=json");
              
                this.sleep(3000)
                var tmpStr = "{"
                jQuery.ajax({
                    url: uri_response,
                    type: 'get',
                    async: false,
                    success: function (results) {
                        res = results["results"][0]["_raw"]
                        res = res.split(', ')
                        res.shift();
                        
                        for(i = 0; i < res.length; ++i){
                            try{
                                res[i] = res[i].trim();
                                res[i] = res[i].split("=");
                                if(excludedFields.indexOf(res[i][0]) == -1){
                                    res[i][1] = res[i][1].replace(/['"]+/g, '');
                                    res[i][1] = res[i][1].replaceAll('\\\\\\', '');
                                    tmpStr = tmpStr + '"' + res[i][0].toString() + '" : "' + res[i][1] + '"' ;
                                    if(i < res.length - 1){
                                        tmpStr = tmpStr + ',';
                                    }
                                }
                            }catch(error){
                                continue;
                            }
                        }
                        tmpStr = tmpStr + "}";
                    }.bind(this)
                });
                
                return JSON.parse(tmpStr);
            },

            /**
             * loadValues in form fields
             * @param {*} tmpJson JSON cointaining the title, description, scope and _key.
             */
            loadValues: function(tmpJson){
                $("#rule-title").val(tmpJson["title"]);
                $("#rule-description").val(tmpJson["description"]);
                if(tmpJson["scope"]){
                    $("#rule-scope").val(tmpJson["scope"]);
                }else{
                    $("#rule-scope").val(tmpJson["search_name"]);
                }
                $("#rule-key").val(tmpJson["_key"]);

            },

            /**
             * Prepare JSON based on the condition for the table.
             * @param {*} tmpJson Raw conditions to parse
             * @returns return a JSON formatted for DataTables javascript
             */
            prepareValues: function(tmpJson){
                var tmpStr = "[";
                var keys = Object.keys(tmpJson);
                for(var i = 0; i < keys.length; ++i){
                    if((keys[i] != "title") && (keys[i] != "description") && (keys[i] != "search_name")){
                        tmpStr = tmpStr + 
                            '{ "check":false, "field":"' + keys[i] + '", "operator": "is", "value" : "' + tmpJson[keys[i]].replaceAll('\\','\\\\') + '", "iscasesensitive":false }'    
                            if(i < res.length - 1){
                                tmpStr = tmpStr + ','
                            }                        
                    }
                }
                if(tmpStr.substr(tmpStr.length - 1) == ","){
                    tmpStr = tmpStr.slice(0, -1)
                }
                tmpStr += "]"
                return JSON.parse(tmpStr)
            },

            /**
             * Setup the table with the data.
             */
            setupTable: function (data, selectColumnVisible, action, conditionLogs) {
                var pageWidth  = document.getElementById('dataTable').offsetWidth
                var slice = pageWidth  / 32
                var slices = [slice*2 , slice*4, slice*2, slice*13, slice*2, slice*10];

                var oninsertedRow = function(instance) {

                    if (action == "modify"){

                        message = "New row added"
                        conditionLogs.push({message: message, values: 1})
                    }
                }

                var onchange = function(instance,data,x,y, textContent) {

                    let col;
                    
                    if (action == "modify"){

                        switch(x){
                            case "0":
                                col = "field";
                                break;
                            case "1":
                                col = "operator";
                                break;
                            case "2":
                                col = "value";
                                break;
                            case "3":
                                col = "iscasensitive";
                                break;
                            case "4":
                                col = "comment";
                                break;
                            default:
                                col = x
                        }
                        
                        message = 'Change found for row ' + y

                        conditionLogs.push({message: message, columns: col, values: textContent})                     
                                                    
                    }
                    
                }

                var onbefeforepaste = function(instance, data, x, y) {
                    data = data.replace(/"{1,3}/g, '″', data);
                    return data;
                }

                var onbeforedeleterow = function(instance,data,x,y) {
                    
                    if (action == "modify"){
                        var rowData = instance.jexcel.getRowData(data)

                        values = '' + rowData[0] + "¬" + rowData[1] + "¬" + rowData[2] + "¬" +  rowData[3] + "¬" +  rowData[4] + "¬" +  rowData[5] + ''


                        message = "Row data deleted at line " + data
                        conditionLogs.push({message: message, columns: 'field¬operator¬value¬iscasensitive¬comment', values: values})
                    }

                }

                var ondeleterow = function(instance,data,x,y) {
                    if (action == "modify"){
                        message = "Row deleted at line " + data
                        conditionLogs.push({message: message, values: data})
                    }
                   
                }

                var options = {
                    minDimensions:[5,1],
                    data: data,
                    tableWidth: pageWidth,
                    tableoverflow: false,
                    startRows: 1,
                    startCols: 1,
                    minSpareRows: 0,
                    minSpareCols: 0,
                    rowResize: 1,
                    colHeaders: ["select", "field", "operator", "value", "iscasesensitive","comment"],
                    colWidths: slices,
                    columns: [
                        {
                            data: "select", 
                            type: "checkbox"
                        },
                        {
                            data: "field", 
                            type: "text", 
                            align: "left"
                        },
                        {
                            data: "operator",
                            type: "dropdown",
                            source: ["<", ">", "is", "is not", "<=", ">=", "contains", "does not contain", "starts with", "ends with", "matches", "does not match"],
                            autocomplete: "true"
                        },
                        {data: "value", type: "text", align: "left"},
                        {
                            data: "iscasesensitive",
                            type: "checkbox",
                        },
                        {
                            data: "comment", 
                            type: "text", 
                            align: "left"
                        }
                    ],
                    columnDefs:[
                        {
                            targets: [0],
                            visible: false
                        }
                    ],
                    rowHeaders: false,
                    stretchH: 'all',
                    manualColumnResize: true,
                    manualColumnMove: false,
                    fixedRowsTop: 0,
                    height: $(document).height() - 320,
                    allowInsertColumn: false,
                    allowManualInsertColumn: false,
                    allowDeleteColumn: false,
                    allowRenameColumn: false,
                    onbeforepaste: onbefeforepaste,
                    onchange: onchange,
                    oninsertrow: oninsertedRow,
                    onbeforedeleterow: onbeforedeleterow,
                    ondeleterow: ondeleterow,
                }
                if(!selectColumnVisible){
                    options.colHeaders.shift();
                    options.columns.shift();
                    options.colWidths.shift();
                }
                this.jexcel = $("#dataTable").jexcel(options);
            },
            
            /**
             * Show form
             */
            showForm: function(){
                $("#tableEditor").show();
                $(".table-loading-message").hide();
            },

            /**
             * Get conditions from DataTable 
             * @returns a JSON containing the conditions
             */
            doGetConditions: function(){
                var row_data = this.jexcel.getData();
                if(this.validate(row_data, action) === false){
                    return null;
                }

                var conditions = Array();
                    _.each(row_data, function (rule) {

                        if(rule.length == 6 && rule[0] == true){
                            conditions.push({field: rule[1], operator: rule[2], value: rule[3], iscasesensitive: rule[4], comment: rule[5]});
                        }else if (rule[0]){
                            conditions.push({field: rule[0], operator: rule[1], value: rule[2], iscasesensitive: rule[3], comment: rule[4]});
                        }
                    });
                return conditions;
            },

            /**
             * Get a rule from a key from the KV Store
             * @param {*} key key of the rule
             * @returns the rule
             */
            getRule: function (key) {
                var uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "/" + key + "?output_mode=json");
                var rule = [];


                jQuery.ajax({
                    url: uri,
                    type: 'GET',
                    async: false,
                    success: function (results) {
                        rule = results;
                    }.bind(this)
                });

                return rule;
            },

            populateFormWithManagedLookup: function (rule, only_if_blank) {
                
                if (typeof only_if_blank === 'undefined') {
                    only_if_blank = false;
                }

                if ($('#rule-title', this.$el).val().length === 0 || !only_if_blank) {
                    $('#rule-title', this.$el).val(rule.title);
                }

                if ($('#rule-description', this.$el).val().length === 0 || !only_if_blank) {
                    $('#rule-description', this.$el).val(rule.description);
                }

                if (rule.type !== null && $('#rule-type', this.$el).val() !== rule.type) {
                    $('#rule-type', this.$el).val(rule.type);
                }

                if (rule.match_type !== null && $('#rule-match-type', this.$el).val() !== rule.match_type) {
                    $('#rule-match-type', this.$el).val(rule.match_type);
                }

                if ($('#rule-scope', this.$el).val().length === 0 || !only_if_blank) {
                    $('#rule-scope', this.$el).val(rule.scope);
                }

                if ($('#rule-comment', this.$el).val().length === 0 || !only_if_blank) {
                    $('#rule-comment', this.$el).val(rule.comment);
                }

                if (rule.startDate && rule.startDate.length === 0 || !only_if_blank) {
                    $('#rule-startDate_date', this.$el).val(rule.startDate.split("T")[0]);
                    $('#rule-startDate_time', this.$el).val(rule.startDate.split("T")[1]);
                }

                if (rule.endDate && rule.endDate.length === 0 || !only_if_blank) {
                    $('#rule-endDate_date', this.$el).val(rule.endDate.split("T")[0]);
                    $('#rule-endDate_time', this.$el).val(rule.endDate.split("T")[1]);
                }

                $('#rule-key', this.$el).val(rule._key);

                this.populated_form_automatically = true;
            },

            /**
             * Validate the table data.
             */
             validate: function (data, action) {
                let isValid = true;
                let errorMsg = "";

                // Check minimum one row
                if (data.length < 1) {
                    isValid = false;
                    errorMsg = "You need to have at least one row";
                }

                // Make sure you have at least two rows if this an All(AND) match type rule
                if ($('#rule-match-type', this.$el).val() === "all" && (data.length < 2)) {
                    isValid = false;
                    errorMsg = "You need to define at least two rules";
                }
                 
                // Check for empty cells + field format
                let badChars = /[\\|\/|\||;|:|&|@]/g;
                let numOperators = /<|>/g;
                let isNum = /^[0-9]+$/;

                if (action == "whitelist"){
                    start = 1;
                }else{
                    start = 0;
                }

                for (i = 0 ; i < data.length; ++i) {
                    for (j = start; j < data[i].length; ++j) {
                        if (!data[i][j] && j < 2) {                       
                            isValid = false;
                            errorMsg = "All cells need to be fulfilled";
                        } else if (data[i][1].match(numOperators) && !data[i][2].match(isNum)) {
                            isValid = false;
                            errorMsg = "The value for operators <,>,<=,>= should be numeric";
                        } else if (j === 0 && data[i][j].match(badChars)) {
                            isValid = false;
                            errorMsg = "Bad char found in a \"field\" column cell";
                        } else if (j === 1 && (data[i][j] === "matches" || data[i][j] === "does not match")) {
                            try {
                                if (data[i][j+2] === false) {
                                    isValid = false;
                                    errorMsg = "Case sensitivity should always be enabled when using a regex (\"matches\" or \"does not match\")"; 
                                }
                                let tmpRegex = /^\(\?(i|s|m|x|n|d|\^)\)/;
                                let tmp = data[i][j+1].replace(tmpRegex,"")
                                let re = new RegExp(tmp);
                                re.test("test string");
                            } catch(e) {
                                isValid = false;
                                statusFlag = 5;
                                errorMsg = "The regex is malformed on line " + (i+1);
                            }
                        }
                    }
                }

                // Check max size
                let maxSize = 10000;
                if (data.length >= maxSize) {
                    isValid = false;
                    errorMsg = "The size of the spreadsheet exceeds 10'000 lines";
                }

                // Display error
                if (isValid === false) {
                    $("#item-data-table > div > .widgeterror").text(errorMsg);
                    $("#item-data-table > div > .widgeterror").show();
                    $("#save > span").text("Save");
                    alert(errorMsg);
                }

                return isValid;
            },

            /**
             * Create a rule in the KV store
             * @param {*} conditions Conditions of the rule
             * @returns 
             */
            doCreateRule: function (conditions, action) {

                // Determine if this is a new entry
                var is_new = false;
                var key = $("#rule-key").val();
 
                if(key === "" || action == "whitelist"){
                    is_new = true;
                }

                // Get the managed lookup info (if not new)
                var rule = {};
                if (!is_new) {
                    rule = this.getRule(key);
                }

                // Update the attributes
                rule.title = $('#rule-title', this.$el).val();
                rule.description = $('#rule-description', this.$el).val();
                rule.type = $('#rule-type', this.$el).val();
                rule.match_type = $('#rule-match-type', this.$el).val();
                rule.scope = $('#rule-scope', this.$el).val();
                rule.comment = $('#rule-comment', this.$el).val();
                if($('#rule-startDate_date', this.$el).val()){
                    if($('#rule-startDate_time', this.$el).val()){
                        
                        rule.startDate = $('#rule-startDate_date', this.$el).val() + "T" + $('#rule-startDate_time', this.$el).val();
                    }else{
                        rule.startDate = $('#rule-startDate_date', this.$el).val() + "T" + "00:00";
                    }
                }else{
                    rule.startDate = "";
                }
                if($('#rule-endDate_date', this.$el).val()){
                    if($('#rule-endDate_time', this.$el).val()){
                        rule.endDate = $('#rule-endDate_date', this.$el).val() + "T" + $('#rule-endDate_time', this.$el).val();
                    }else{
                        rule.endDate = $('#rule-endDate_date', this.$el).val() + "T" + "23:59";
                    }
                }else{
                    rule.endDate = "";
                }
                
                var dateTime = this.getDateTime();
                rule.modificationDate = dateTime;
                rule.modificationUser = currentUser;
                rule.conditions = conditions;

                // If new rule, set value for creation date, status and creation user
                if (is_new) {
                    rule.creationDate = this.getDateTime();
                    rule.disabled = "false";
                    rule.creationUser = currentUser;
                }

                
                // Check if end date are not before start date
                var epoch_startDate = Date.parse(rule.startDate);
                var epoch_endDate = Date.parse(rule.endDate);
                if ( epoch_endDate < epoch_startDate ){
                    alert("End date must be later than start date.");
                    return false;
                }

                // Check if Title and scope value are not empty
                if ( !rule.title | !rule.scope ){
                    alert("Title and scope must be set.");
                    return false;
                }

                // Check if rule type is populate
                if (rule.type == "base"){
                    alert("Rule type must be set.");
                    return false;

                }

                return rule;
            },

            /**
             * Update the rule in the KV store
             * @param {*} rule The rule to updated
             * @param {*} key The key of the rule to update. Null if a new rule
             * @returns boolean 
             */
            doUpdateToRule: function (rule, key, action) {

                var uri = null;
                var new_key = null;

                // If a key was provided, filter down to it
                if (key === undefined || key === "" || key === null || action == "whitelist") {
                    uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "?output_mode=json");
                } else {
                    uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "/" + key + "?output_mode=json");
                }

                jQuery.ajax({
                    url: uri,
                    type: 'POST',
                    async: false,
                    contentType: "application/json",
                    data: JSON.stringify(rule),
                    error: function (jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status === 403) {
                            alert("You do not have permission to update rules.");
                        } else {
                            alert("The rule could not be modified: \n\n" + errorThrown);
                        }
                    },
                    success: function (response) {
                        if(action == "add" || action == "whitelist"){
                            new_key = response._key
                        }
                    }.bind(this)
                });

                return new_key;
            },

            /**
             * manage the workflow to save the rule
             * @param {*} action 
             */
            doSaveRule: function(action){
                var conditions = this.doGetConditions(action);

                if(conditions != null){

                    var rule = this.doCreateRule(conditions, action);

                    if(rule === false) { // Error checks
                        return
                    }

                    var key = $("#rule-key").val();
                    newkey = this.doUpdateToRule(rule, key, action);

                    if (action == "modify"){

                        if (beforeRule["title"] != rule["title"]){

                            auditlog = {};
                            auditlog["time"] = this.getDateTime();
                            auditlog["log_level"] = "INFO"
                            auditlog["component"] = "EventMasker"
                            auditlog["user"] = currentUser
                            auditlog["key"] = key
                            auditlog["type"] = "update"
                            auditlog["message"] = 'Title changed to : ' + rule["title"]
                                
                            this.doWriteToIndex(auditlog);

                        }

                        if (beforeRule["scope"] != rule["scope"]){

                            auditlog = {};
                            auditlog["time"] = this.getDateTime();
                            auditlog["log_level"] = "INFO"
                            auditlog["component"] = "EventMasker"
                            auditlog["user"] = currentUser
                            auditlog["key"] = key
                            auditlog["type"] = "update"
                            auditlog["message"] = 'Scope changed to : ' + rule["scope"]
                            
                            this.doWriteToIndex(auditlog);

                        }

                        if (beforeRule["match_type"] != rule["match_type"]){

                            auditlog = {};
                            auditlog["time"] = this.getDateTime();
                            auditlog["log_level"] = "INFO"
                            auditlog["component"] = "EventMasker"
                            auditlog["user"] = currentUser
                            auditlog["key"] = key
                            auditlog["type"] = "update"
                            auditlog["message"] = 'Match type changed to : ' + rule["match_type"]
                            
                            this.doWriteToIndex(auditlog);

                        }


                        for (i = 0; i < conditionLogs.length; ++i) {

                            auditlog = {};
                            auditlog["time"] = this.getDateTime(); 
                            auditlog["log_level"] = "INFO"
                            auditlog["component"] = "EventMasker"
                            auditlog["user"] = currentUser
                            auditlog["key"] = key
                            auditlog["type"] = "update"
                            auditlog["message"] = conditionLogs[i]["message"]
                            auditlog["columns"] = conditionLogs[i]["columns"]
                            auditlog["values"] = conditionLogs[i]["values"]
                            
                            this.doWriteToIndex(auditlog);

                        }

                    }else{
                            // For a new rule
                            for(i = 0; i < conditions.length; ++i){

                                auditlog = {};
                                auditlog["time"] = this.getDateTime(); 
                                auditlog["log_level"] = "INFO"
                                auditlog["component"] = "EventMasker"
                                auditlog["user"] = currentUser
                                auditlog["key"] = newkey
                                auditlog["type"] = "new"
                                auditlog["message"] = 'Rule creation with condition for row ' + i
                                auditlog["columns"] = 'field¬operator¬value¬iscasensitive¬comment'
                                auditlog["values"] = conditions[i]["field"] + "¬" + conditions[i]["operator"] + "¬" + conditions[i]["value"] + "¬" + conditions[i]["iscasesensitive"] + "¬" + conditions[i]["comment"]

                                this.doWriteToIndex(auditlog);
                            }
                        }
                    

                    window.location.href = '/app/event_masker/masker_rules'
                }
                
            },
            
            saveRule: function () {
                this.doSaveRule(action);
            },

            gotoToList: function(){
                window.location.href = '/app/event_masker/masker_rules'
            },

            /**
            * Find the differences between two objects and return field name and field value
            */
             diff: function (obj1,obj2) {

                var result = {};

                for(key in obj1) {

                    if(obj2[key] != obj1[key]) result[key] = obj2[key];

                    if(typeof obj2[key] == 'array' && typeof obj1[key] == 'array') 
                        result[key] = arguments.callee(obj1[key], obj2[key]);

                    if(typeof obj2[key] == 'object' && typeof obj1[key] == 'object') 
                        result[key] = arguments.callee(obj1[key], obj2[key]);
                }
                return result;
                
            },

            render: function () {
                
                var key = this.getParameterByName("key");
                
                var re = new RegExp("^[a-f0-9]{32}-[0-9]*$");               
                
                insufficient_permissions = false;
                this.$el.html(_.template(EventMaskerFormTemplate, {
                    lister: this.lister,
                    insufficient_permissions: insufficient_permissions,
                    tmpJson: tmpJson,
                    title : "Add rule",
                    list_link: this.list_link,
                    list_link_title: this.list_link_title,
                    is_new: false 
                }));

                if(key == "" || key == null){
                    action = "add";
                    this.getSelectOption();
                    this.setupTable(null,false, action);
                }
                else if(re.test(key)){
                    action="whitelist";
                    var results = key.split("-");
                    tmpJson = this.getNotable(results[0], results[1]);
                    this.loadValues(tmpJson);
                    values = this.prepareValues(tmpJson);
                    this.getSelectOption();
                    this.setupTable(values, true, action);
                    $('#rule-key', this.$el).val(key);
                }else{
                    action="modify";
                    var rule = this.getRule(key);
                    this.getSelectOption(rule);
                    this.setupTable(rule.conditions, false, action, conditionLogs);
                    $('#rule-key', this.$el).val(key);
                    beforeModification = rule.conditions;
                    beforeRule = rule;
                }

                this.showForm();
            }
        });


        return EventMaskerFormView;
    });
