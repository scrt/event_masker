require.config({
    paths: {
        "datatables": "../app/event_masker/contrib/DataTables/js/jquery.dataTables",
        "select": "../app/event_masker/contrib/Select/js/dataTables.select.min",
        "buttons": "../app/event_masker/contrib/Buttons/js/dataTables.buttons.min",
        "buttons-colvis": "../app/event_masker/contrib/Buttons/js/dataTables.buttons.colVis.min",
        text: "../app/event_masker/contrib/text",
    },
    map: {
        '*': {
          'datatables.net': 'datatables',
          'datatables.net-buttons': 'datatables',
        }
    },
});


define(['underscore',
        'splunkjs/mvc',
        'jquery',
        'splunkjs/mvc/simplesplunkview',
        'text!../app/event_masker/templates/EventMaskerRuleList.html',
        "datatables",
        "css!../app/event_masker/contrib/DataTables/css/jquery.dataTables.css",
        "select",
        "buttons",
        "buttons-colvis",
        "css!../app/event_masker/contrib/Select/css/select.dataTables.min.css",
        "css!../app/event_masker/contrib/Buttons/css/buttons.dataTables.min.css",
        "css!../app/event_masker/EventMaskerRuleList.css",
    ],
    function (_, mvc, $, SimpleSplunkView, EventMaskerRulesListTemplate, dataTables, datetime) {
        
        // Get current user
        var currentUser=Splunk.util.getConfigValue("USERNAME");      
        
        // Define the custom view class
        var EventMaskerListerView = SimpleSplunkView.extend({
            className: "EventMaskerListerView",

            events: {
                "click .edit_rule": "editRule",
                "click .add_rule": "addRule",
                "click .save_rule": "doEditRule",
                "click .enable_rule": "toggleRule",
                "click .disable_rule": "toggleRule",
                "click .remove_rule": "removeRule",
                "click .clone_rule": "CloneRule",
                "click .select_json_files": "showImportJSONModal",
                "click .import-json-files": "doImportJSONFiles",                
                "click .export_json": "exportJson",
                "click .export_selected_json" : "exportSelectedJson",
                "click .delete_selected" : "deleteSelected",
                "click .enable_selected" : "toggleSelected",
                "click .disable_selected" : "toggleSelected",
                "click .download_json": "downloadJSON"
            },

            defaults: {
                collection_owner: "nobody",
                include_filter: null,
                list_link: null,
                list_link_title: "Back to list",
                allow_editing_collection: true
            },

            initialize: function () {
                this.options = _.extend({}, this.defaults, this.options);

                this.list_link = this.options.list_link;
                this.list_link_title = this.options.list_link_title;
                this.editor = this.options.editor;
                this.include_filter = this.options.include_filter;
                this.allow_editing_collection = this.options.allow_editing_collection;

                this.collection_owner = this.options.collection_owner;
                this.app = this.options.app;
                this.collection = this.options.collection;

                this.rules = null;
                this.unfiltered_rules = null;

            },

            showEditRuleModal: function (key) {

                // Get the managed lookup info
                var rule = this.getRule(key);

                // Populate the form
                this.populateFormWithManagedLookup(rule);

                // Show the modal
                //$('.new-entry', this.$el).hide();
                $('.rule-edit-modal', this.$el).modal();
            },

            editRule: function (event) {
                var key = $(event.target).data('key');
                window.location.href = '/app/event_masker/masker_form?key='+key;
                //this.showEditRuleModal(key);
            },

            /**
             * Function in charge of displaying the modal form used to import JSON files.
             * @param {*} key 
             */
            showImportJSONModal: function (key) {
                document.getElementById("multiple_files").value = "";
                var generalDiv = document.getElementById('generalDiv');
                if(generalDiv){
                    generalDiv.innerHTML = "";
                }
                
                if(!document.getElementById("importButton").classList.contains("importButton")){
                    document.getElementById("importButton").classList.add("import-json-files");
                }
                // Show the modal
                //$('.new-entry', this.$el).hide();
                $('.import-json-modal', this.$el).modal();
            },

            /**
             * Function to import JSON files.
             */
            doImportJSONFiles: function () {

                // Disabling import button
                document.getElementById("importButton").classList.remove("import-json-files");

                // Get datetime
                var today = new Date();
                var month = today.getMonth()+1
                if (month < 10){
                    month = "0" + month
                }
                var day = today.getDate()
                if (day < 10){
                    day = "0" + day
                }
                var minutes = today.getMinutes()
                if (minutes < 10){
                    minutes = "0" + minutes
                }
                var hours = today.getHours()
                if (hours < 10){
                    hours = "0" + hours
                }
                var date = today.getFullYear()+'-'+ month +'-'+ day;
                var time = hours + ":" + minutes;
                var dateTime = date+'T'+time;


                var self = this;
                
                var files = document.getElementById("multiple_files").files;

                // Check if generalDiv exists, if not, create it. 
                generalDiv = document.getElementById("generalDiv");
                if(!generalDiv){
                    generalDiv = document.createElement('div');
                }
                
                generalDiv.setAttribute('id', 'generalDiv');

                // Go accross all files to read them.
                for(var i = 0; i < files.length; ++i){

                    // Displaying file name, progress bar and status of each import.

                    //general div
                    let divElement = document.createElement('div');
                    divElement.setAttribute('id', "modalDiv");
                    divElement.style.fontWeight = "bold";
                    //filename div
                    let divElementText = document.createTextNode(files[i].name);
                    // Div for progress bar and status 
                    let divProgressAndStatus = document.createElement('div');

                    // progress bar
                    let progressBar = document.createElement('progress');
                    progressBar.setAttribute('id', files[i].name + "_progressBar");
                    progressBar.setAttribute('max', "100");
                    progressBar.setAttribute("value", 0);
                    progressBar.style.transition = "0.1s";
                    progressBar.style.backgroundColor = "#5CC05C";
                    progressBar.innerHTML = "0%";

                    // status div
                    let divStatus = document.createElement('div');
                    divStatus.style.fontWeight = "normal";
                    divStatus.setAttribute('id', files[i].name + "_status");
                    let divStatusText = document.createTextNode("Status : Processing...");
                    divStatus.appendChild(divStatusText)
                    
                    divProgressAndStatus.appendChild(progressBar);
                    divProgressAndStatus.appendChild(divStatus);

                    divElement.appendChild(divElementText);
                    divElement.appendChild(divProgressAndStatus);
                    generalDiv.appendChild(divElement);
                    document.getElementById('multiple_files_div').appendChild(generalDiv);
                }


                function displayError(reader){
                    var tmp = document.getElementById(reader.fileName+"_status");

                    document.getElementById(reader.fileName+"_progressBar").setAttribute("value", 100);
                    document.getElementById(reader.fileName+"_progressBar").style.color = "red";
                    tmp.removeChild(tmp.firstChild);
                    tmp.appendChild(document.createTextNode("Status : Error"));
                    tmp.style.color="red";
                }
                
                function checkAttributes(json){
                    if(!json.hasOwnProperty("title") || !json.hasOwnProperty("description") || !json.hasOwnProperty("disabled")
                        || !json.hasOwnProperty("type") || !json.hasOwnProperty("match_type") || !json.hasOwnProperty("scope") || 
                        !json.hasOwnProperty("conditions") || !json.hasOwnProperty("startDate") || !json.hasOwnProperty("endDate")
                    ){
                        return false;
                    }
                    return true;
                }

                /**
                 * Read file and create rules.
                 * @param {File} file  
                 */
                function readFile(file){
                    var reader = new FileReader();
                    var file = files[i];
                    if(file){
                        reader.onload = function (event) {
                        var json = JSON.parse(reader.result);
                        if(json){
                            try{
                                if(!json.length){
                                    displayError(reader);
                                }
                                var percentage = 0;
                                for(var i = 0; i < json.length; ++i){
                                    if(!checkAttributes(json[i])){
                                        displayError(reader);
                                        return false;
                                    }
                                    var rule = {};
                                    key = "";
                                    rule.title = json[i]["title"];
                                    rule.description = json[i]["description"];
                                    if(json[i].hasOwnProperty("comment")){
                                        rule.comment = json[i]["comment"];
                                    }
                                    rule.creationDate = dateTime;
                                    rule.disabled = json[i]["disabled"];
                                    rule.type = json[i]["type"];
                                    rule.match_type = json[i]["match_type"];
                                    rule.creationUser = currentUser;
                                    rule.scope = json[i]["scope"];
                                    rule.conditions = json[i]["conditions"];
                                    rule.modificationUser = currentUser;
                                    rule.startDate = json[i]["startDate"];
                                    rule.endDate = json[i]["endDate"];
                                    self.doUpdateToRule(rule, key);
                                    percentage = Math.trunc((i / json.length) * 100);
                                    if(!(percentage % 5)){
                                        document.getElementById(reader.fileName+"_progressBar").setAttribute("value", i);
                                        document.getElementById(reader.fileName+"_progressBar").innerHTML = Math.trunc(i) + " %";
                                        var tmp = document.getElementById(reader.fileName+"_status").innerHTML = "Status : Processing (" + percentage + ")";
                                        console.log(percentage)
                                    }
                                    if(i == (json.length - 1)){
                                        document.getElementById(reader.fileName+"_progressBar").setAttribute("value", 100);
                                        document.getElementById(reader.fileName+"_progressBar").innerHTML = Math.trunc(i) + " %";
                                        var tmp = document.getElementById(reader.fileName+"_status");
                                        tmp.removeChild(tmp.firstChild);
                                        tmp.appendChild(document.createTextNode("Status : Imported (" + 100 + "%)"));
                                    }
                                }
                                return true;
                            }catch(e){
                                console.log(e);
                                return false;
                            }
                                
                        }
                    }
                    reader.fileName = file.name;
                    reader.readAsText(file, "UTF-8");
                    }else{
                        alert("Please select a JSON file to import.")
                    }
                }

                // Start importing 
                for(var i = 0; i < files.length; ++i){
                    readFile(files[i]);
                }

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

            addRule: function (event) {

                // Clear the form
                window.location.href = '/app/event_masker/masker_form';
            },
            
            exportJson: function (event) {

                var rules_list = this.getRules(true);

                dataStr = JSON.stringify(rules_list);

                var element = document.createElement('a');
                var blob = new Blob([dataStr], {type: "octet/stream"})
                var url = URL.createObjectURL(blob);
                element.setAttribute('href', url);
                element.setAttribute('download', "export.json");
                element.click();
            },
            
            exportSelectedJson: function(event){
                var rulesList = [];
                var table = $('#table').DataTable();
                var selectedRows = table.rows({selected: true}).data();

                for(var i = 0; i < selectedRows.length; ++i){
                    var key = selectedRows[i][1];
                    rulesList.push(this.getRule(key));
                }

                dataStr = JSON.stringify(rulesList);
                
                var element = document.createElement('a');
                var blob = new Blob([dataStr], {type: "octet/stream"})
                var url = URL.createObjectURL(blob);
                element.setAttribute('href', url);
                element.setAttribute('download', "export.json");
                element.click();

            },

            deleteSelected: function(event){

                var table = $('#table').DataTable();
                var selectedRows = table.rows({selected: true}).data();
                if (confirm('Are you sure you want to delete selected rules ('+selectedRows.length+') ?')) {
                    for(var i = 0; i < selectedRows.length; ++i){
                        var key = selectedRows[i][1];
                        this.deleteRule(key);
                    }
                }

            },

            CloneRule: function (event) {

                // Get the key of the item which want to be clone and get value
                var key = $(event.target).data('key');
                var rule = {};
                rule = this.getRule(key);

               // Get datetime
                var today = new Date();
                var month = today.getMonth()+1
                if (month < 10){
                    month = "0" + month
                }
                var day = today.getDate()
                if (day < 10){
                    day = "0" + day
                }
                var minutes = today.getMinutes()
                if (minutes < 10){
                    minutes = "0" + minutes
                }
                var hours = today.getHours()
                if (hours < 10){
                    hours = "0" + hours
                }
                var date = today.getFullYear()+'-'+ month +'-'+ day;
                var time = hours + ":" + minutes;
                var dateTime = date+'T'+time;
                
                // Set clone rule with value get previously
                var rule_clone = {};
                key = ""
                rule_clone.title = rule.title + "_clone";
                rule_clone.description = rule.description;
                rule_clone.comment = rule.comment;
                rule_clone.creationDate = dateTime;
                rule_clone.disabled = rule.disabled;
                rule_clone.type = rule.type;
                rule_clone.match_type = rule.match_type;
                rule_clone.creationUser = currentUser;
                rule_clone.scope = rule.scope;
                rule_clone.conditions = rule.conditions;
                rule_clone.modificationUser = currentUser;
                rule_clone.startDate = rule.startDate;
                rule_clone.endDate = rule.endDate;

                this.doUpdateToRule(rule_clone, key);
            },

            clearForm: function () {
                $('#rule-type', this.$el).val("normal");
                $('#rule-match-type', this.$el).val("any");
                $('#rule-title', this.$el).val("");
                $('#rule-description', this.$el).val("");
                $('#rule-scope', this.$el).val("");
                $('#rule-comment', this.$el).val("");
                $('#rule-key', this.$el).val("");
                $('#rule-startDate_date', this.$el).val("");
                $('#rule-startDate_time', this.$el).val("");
                $('#rule-endDate_date', this.$el).val("");
                $('#rule-endDate_time', this.$el).val("");
            },

            doEditRule: function () {

                // See if the input is valid
                /*if( !this.validate() ){
                    return false;
                }*/

                // Get the key of the item being edited
                var key = $('#rule-key', this.$el).val(); // This will be empty for new items

                // Determine if this is a new entry
                var is_new = false;

                if (key === "") {
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
                    rule.startDate = $('#rule-startDate_date', this.$el).val() + "T" + $('#rule-startDate_time', this.$el).val();
                }else{
                    rule.startDate = "";
                }
                if($('#rule-endDate_date', this.$el).val()){
                    rule.endDate = $('#rule-endDate_date', this.$el).val()+ "T" + $('#rule-endDate_time', this.$el).val();
                }else{
                    rule.endDate = "";
                }
                
                // Get datetime
                var today = new Date();
                var month = today.getMonth()+1
                if (month < 10){
                    month = "0" + month
                }
                var day = today.getDate()
                if (day < 10){
                    day = "0" + day
                }
                var minutes = today.getMinutes()
                if (minutes < 10){
                    minutes = "0" + minutes
                }
                var hours = today.getHours()
                if (hours < 10){
                    hours = "0" + hours
                }
                var date = today.getFullYear()+'-'+ month +'-'+ day;
                var time = hours + ":" + minutes;
                var dateTime = date+'T'+time;
                rule.modificationDate = dateTime;
                rule.modificationUser = currentUser;

                // If new rule, set value for creation date, status and creation user
                if (is_new) {
                    rule.creationDate = dateTime;
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

                this.doUpdateToRule(rule, key);
                return true;
            },

            toggleRule: function (event) {
                var key = $(event.target).data('key');
                var disabled = $(event.target).data('disabled');

                rule = this.getRule(key);
                rule.disabled = disabled;
                this.doUpdateToRule(rule, key);
            },

            toggleSelected: function (event) {

                var table = $('#table').DataTable();
                var selectedRows = table.rows({selected: true}).data();
                var action = event.target.id
           
                for(var i = 0; i < selectedRows.length; ++i){
                    var key = selectedRows[i][1];
                    


                    if (action == "enableSelected"){

                        rule = this.getRule(key);
                        rule.disabled = false;
                        this.doUpdateToRule(rule, key);

                    }
    
                    if (action == "disableSelected"){

                        rule = this.getRule(key);
                        rule.disabled = true;
                        this.doUpdateToRule(rule, key);
    
                    }
                }
                 
            },



            removeRule: function (event) {
                var key = $(event.target).data('key');
                rule = this.getRule(key);

                if (confirm('Are you sure you want to delete: "' + rule.title + '"?')) {
                    this.deleteRule(key);
                    return true;
                } else {
                    return false;
                }
            },

            deleteRule: function(key){
                var uri = null;

                // If a key was provided, filter down to it
                if (key === undefined || key === "" || key === null) {
                    alert("Unknown error. Please try again.");
                    return false;
                } else {
                    uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "/" + key + "?output_mode=json");
                }

                jQuery.ajax({
                    url: uri,
                    type: 'DELETE',
                    async: false,
                    contentType: "application/json",
                    error: function (jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status === 403) {
                            alert("You do not have permission to update rules.");
                        } else {
                            alert("The rule could not be modified: \n\n" + errorThrown);
                        }
                    },
                    success: function () {
                        this.renderRulesList();
                    }.bind(this)
                });
            },

            doUpdateToRule: function (rule, key) {

                var uri = null;

                // If a key was provided, filter down to it
                if (key === undefined || key === "" || key === null) {
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
                    success: function () {
                        this.renderRulesList();
                        $('.rule-edit-modal', this.$el).modal('hide');
                    }.bind(this)
                });

                return true;
            },

            getRules: function (force_reload) {

                // Default the arguments
                if (typeof force_reload === "undefined") {
                    force_reload = false;
                }

                // Return the existing list if we can
                if (this.rules !== null && !force_reload) {
                    return this.rules;
                }

                this.rules = this.getRule("");
                return this.rules;

            },

            getRule: function (key) {
                var uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "/" + key + "?output_mode=json");
                var rules = null;

                jQuery.ajax({
                    url: uri,
                    type: 'GET',
                    async: false,
                    success: function (results) {

                        // Use the include filter function to prune items that should not be included (if necessary)
                        if (key === "" && this.include_filter !== null) {
                            rules = [];

                            // Store the unfiltered list of lookups
                            this.unfiltered_rules = results;

                            for (var c = 0; c < results.length; c++) {
                                if (this.include_filter(results[c])) {
                                    rules.push(results[c]);
                                }
                            }
                        }

                        // Just pass the lookups if no filter is necessary.
                        else {
                            rules = results;
                        }
                    }.bind(this)
                });

                return rules;
            },

            renderRulesList: function () {
                var rules = this.getRules(true);

                //var insufficient_permissions = !this.hasCapability('edit_lookups');
                var insufficient_permissions = false;

                // Template from el
                var lookup_list_template = $('#rule-list-template', this.$el).text();

                $('#table-container', this.$el).html(_.template(lookup_list_template, {
                    rules: rules,
                    editor: Splunk.util.make_url("/app/event_masker/masker_form"),
                    list_link: this.list_link,
                    list_link_title: this.list_link_title,
                    insufficient_permissions: insufficient_permissions,
                    allow_editing_collection: this.allow_editing_collection
                }));

                var columnMetaData = [
                    null,                   // Checkbox
                    null,                   // Hidden key
                    null,                   // Title
                    null,                   // Description
                    null,                   // Match Type
                    null,                   // Rule Type
                    null,                   // Scope
                    null,                   // Comment
                    null,                   // startDate
                    null,                   // endDate
                    null,                   // creationDate
                    null,                   // modificationDate
                    null,                   // creationUser
                    null,                   // modificationUser
                    null,                   // Conditions
                    null,                   // Disabled
                    {"bSortable": false, "searchable": false}  // Actions
                ];

                if (insufficient_permissions) {
                    columnMetaData = [
                        null,                   // Checkbox
                        null,                   // Hidden key
                        null,                   // Title
                        null,                   // Description
                        null,                   // Match Type
                        null,                   // Rule Type
                        null,                   // Scope
                        null,                   // Comment
                        null,                   // creationDate
                        null,                   // startDate
                        null,                   // endDate
                        null,                   // modificationDate
                        null,                   // creationUser
                        null,                   // modificationUser
                        null,                   // Conditions
                        null,                   // Disabled
                    ];
                }

                    var table = $('#table').DataTable({
                        dom: '<frB<t>lip>',
                        iDisplayLength: 25,
                        bStateSave: true,
                        aoColumns: columnMetaData,
                        sScrollX: "100%",
                        sScrollXInner: "100%",
                        buttons: [
                            {
                                extend: 'colvis',
                                collectionLayout: 'fixed two-column',
                                columns: ':gt(0)'
                            }
                        ],
                        columnDefs: [ {
                            orderable: false,
                            className: 'select-checkbox',
                            targets:   0
                            },
                            {
                                targets: 1,
                                visible: false,
                                searchable: false
                            },
                            {
                                searchable: false, 
                                targets: 0 
                            },
                            {
                                type: 'natural-ci',
                                targets: '_all' 
                            }
                        ],
                        select: {
                            style:    'multi',
                            selector: 'td:first-child'
                        },
                        order: [[ 2, 'asc' ]]
                    });

                    table.on( 'select.dt', function ( ) {
                        $("#selectedLinks").css('display','block');
                    });

                    table.on('deselect.dt', function ( ) {
                       if(table.rows({selected: true}).data().length == 0){
                            $("#selectedLinks").css('display','none');
                       }
                    });

                    $('.dataTable').on("click", "th.select-checkbox", function() {
						if ($("th.select-checkbox").hasClass("selected")) {
							table.rows({ search: 'applied' } ).deselect();
							$("th.select-checkbox").removeClass("selected");
						} else {
							table.rows({ search: 'applied' } ).select();
							$("th.select-checkbox").addClass("selected");
						}
					}).on("select deselect", function() {
					("Some selection or deselection going on")
						if (table.rows({
								selected: true
							}).count() !== table.rows({ search: 'applied' } ).count()) {
							$("th.select-checkbox").removeClass("selected");
						} else {
							$("th.select-checkbox").addClass("selected");
						}
					});


            },

            render: function () {
                this.$el.html(EventMaskerRulesListTemplate);
                this.renderRulesList();
            },

        });
        return EventMaskerListerView;
    });
